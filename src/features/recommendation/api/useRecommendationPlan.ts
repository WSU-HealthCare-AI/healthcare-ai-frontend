import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/src/shared/api/supabase";
import {
  AIPlanPayload,
  AIPlanPayloadSchema,
} from "@/src/entities/recommendation/model/schema";

type PlanStatus = "idle" | "syncing" | "generating" | "completed" | "error";

interface FetchOptions {
  skipSyncingState?: boolean;
}

interface ValidationErrorDetails {
  formatted?: Record<string, unknown>;
  issues?: unknown[];
  [key: string]: unknown;
}

class PlanValidationError extends Error {
  public code: string;
  public details?: ValidationErrorDetails;

  constructor(message: string, code: string, details?: ValidationErrorDetails) {
    super(message);
    this.name = "PlanValidationError";
    this.code = code;
    this.details = details;
  }
}

const parseAndValidatePlanPayload = (rawData: unknown): AIPlanPayload => {
  let parsedPayload = rawData;
  if (typeof rawData === "string") {
    try {
      parsedPayload = JSON.parse(rawData);
    } catch {
      throw new PlanValidationError(
        "플랜 데이터 형식이 올바르지 않습니다.",
        "PLAN_PARSE_ERROR",
      );
    }
  }

  const validationResult = AIPlanPayloadSchema.safeParse(parsedPayload);

  if (!validationResult.success) {
    const errorDetails = {
      formatted: validationResult.error.format() as Record<string, unknown>,
      issues: validationResult.error.issues,
    };
    throw new PlanValidationError(
      "플랜 데이터 구조가 예상과 다릅니다.",
      "PLAN_SCHEMA_INVALID",
      errorDetails,
    );
  }

  return validationResult.data;
};

export function useRecommendationPlan(userId?: string) {
  const [plan, setPlan] = useState<AIPlanPayload | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<PlanStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const fetchIdRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchCurrentPlan = useCallback(async (options?: FetchOptions) => {
    if (!userId) return;

    fetchIdRef.current += 1;
    const currentFetchId = fetchIdRef.current;
    const { skipSyncingState = false } = options || {};

    try {
      if (!skipSyncingState) {
        Promise.resolve().then(() => {
          if (isMountedRef.current && currentFetchId === fetchIdRef.current) {
            setStatus("syncing");
          }
        });
      }

      const { data, error: fetchError } = await supabase
        .from("ai_plans")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!isMountedRef.current || currentFetchId !== fetchIdRef.current) {
        return;
      }

      if (fetchError) throw fetchError;

      if (!data) {
        setStatus((prev) => prev === "generating" ? "generating" : "idle");
        setPlan(null);
        setCreatedAt(null);
        setError(null);
        return;
      }

      if (data.status === "completed" && data.plan_payload) {
        const validatedPayload = parseAndValidatePlanPayload(data.plan_payload);

        setPlan(validatedPayload);
        setCreatedAt(data.created_at);
        setStatus("completed");
        setError(null);
      } else if (data.status === "pending") {
        setStatus("generating");
      } else if (data.status === "failed") {
        setStatus("error");
        setError(data.error_message || "플랜 생성에 실패했습니다.");
      } else {
        setPlan(null);
        setStatus("error");
        setError("알 수 없는 플랜 상태입니다.");
      }
    } catch (err: unknown) {
      if (!isMountedRef.current || currentFetchId !== fetchIdRef.current) {
        return;
      }

      setPlan(null);
      setStatus("error");

      if (err instanceof PlanValidationError) {
        if (err.code === "PLAN_PARSE_ERROR") {
          setError(
            "플랜 데이터를 읽는 중 문제가 발생했습니다. 다시 시도해 주세요.",
          );
        } else if (err.code === "PLAN_SCHEMA_INVALID") {
          setError(
            "플랜 데이터가 일부 손상되었습니다. 새로 생성이 필요합니다.",
          );
        } else setError(err.message);
      } else if (err instanceof Error) {
        setError(
          "데이터를 불러오는 중 네트워크 또는 시스템 문제가 발생했습니다.",
        );
      } else {
        setError("알 수 없는 문제가 발생했습니다.");
      }
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      Promise.resolve().then(() => {
        fetchCurrentPlan();
      });
    }
  }, [userId, fetchCurrentPlan]);

  useEffect(() => {
    if (!userId) return;

    const uniqueChannelName = `ai_plans_${userId}_${
      Math.random().toString(36).substring(2, 9)
    }`;
    const channel = supabase
      .channel(uniqueChannelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ai_plans",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          fetchCurrentPlan({ skipSyncingState: true });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchCurrentPlan]);

  useEffect(() => {
    let pollingInterval: ReturnType<typeof setInterval> | undefined;
    if (status === "generating") {
      pollingInterval = setInterval(() => {
        fetchCurrentPlan({ skipSyncingState: true });
      }, 3000);
    }
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [status, fetchCurrentPlan]);

  const retry = useCallback(async () => {
    if (!userId) return;

    setStatus("generating");
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("AUTH_EXPIRED");

      const { error: invokeError } = await supabase.functions.invoke(
        "sync-ai-plan",
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );

      if (invokeError) throw invokeError;
      await fetchCurrentPlan({ skipSyncingState: true });
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      setStatus("error");

      // 에러 코드별 세분화된 UX 라이팅 제공
      if (err && typeof err === "object" && "context" in err) {
        try {
          const payload = await (err as any).context.json();
          const code = payload?.error?.code;

          if (code === "AUTH_ERROR") {
            setError("로그인이 필요합니다. 다시 로그인해 주세요.");
          } else if (code === "VALIDATION_ERROR" || code === "PARSE_ERROR") {
            setError("AI 추천 데이터가 올바르지 않습니다. 다시 시도해 주세요.");
          } else if (code === "NETWORK_ERROR" || code === "LLM_ERROR") {
            setError(
              "AI 서버와 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.",
            );
          } else if (code === "DB_ERROR" || code === "DB_UPDATE_ERROR") {
            setError(
              "서버에 플랜을 저장하는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
            );
          } else {setError(
              payload?.error?.message || "플랜 갱신에 실패했습니다.",
            );}
          return;
        } catch {}
      }

      if (err instanceof Error && err.message === "AUTH_EXPIRED") {
        setError("로그인이 만료되었습니다. 다시 로그인해 주세요.");
      } else {
        setError(
          "플랜 갱신 요청에 실패했습니다. 네트워크 상태를 확인해주세요.",
        );
      }
    }
  }, [userId, fetchCurrentPlan]);

  let currentDay = 1;
  if (createdAt) {
    const createdDate = new Date(createdAt);
    createdDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - createdDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    currentDay = (Math.max(0, diffDays) % 7) + 1;
  }

  return { plan, createdAt, currentDay, status, error, retry };
}
