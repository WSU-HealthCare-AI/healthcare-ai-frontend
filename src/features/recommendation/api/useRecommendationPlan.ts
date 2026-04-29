import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/src/shared/api/supabase";
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";

// AI가 응답하는 JSON 구조에 맞춘 타입 정의
export interface AIRecommendationPlan {
  medical_disclaimer: string;
  risk_flags: string[];
  summary: string;
  calorie_guide: number;
  macro_guide: {
    carbs_pct: number;
    protein_pct: number;
    fat_pct: number;
  };
  workout_plan: {
    weekly_frequency: number;
    intensity: number;
    exercises: {
      name: string;
      reason: string;
      sets: number;
      reps: string;
      rest_sec: number;
      cautions: string;
    }[];
  };
}

// 로딩 상태 세분화해서 UI 애니메이션 분기 처리 가능하게 만듦
export type PlanStatus =
  | "syncing"
  | "generating"
  | "completed"
  | "error"
  | "idle";

export function useRecommendationPlan(userId: string | undefined) {
  const [plan, setPlan] = useState<AIRecommendationPlan | null>(null);
  const [status, setStatus] = useState<PlanStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // setTimeout이나 비동기 콜백 안에서 옛날 status 값(stale closure) 물고 늘어지는 거
  // 방지하려고 최신 상태를 거울처럼 계속 비춰주는 Ref 하나 파둠
  const statusRef = useRef<PlanStatus>(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // isRetry 옵션 추가함. 재시도할 때 기존 데이터 화면에서 날려버리면
  // 화면 하얗게 깜빡여서 UX 구려짐. 기존 플랜 유지하면서 로딩만 돌리게 함.
  const fetchPlan = useCallback(async (isRetry = false) => {
    if (!userId) return;

    // 첫 진입일 때만 싹 비우고, 재시도면 에러 메시지만 지움
    if (!isRetry) setPlan(null);
    setError(null);
    setStatus("syncing"); // 일단 서버랑 통신 시작함

    try {
      // 1. Edge Function 호출해서 현재 플랜 상태 확인
      const { data, error: fnError } = await supabase.functions.invoke(
        "sync-ai-plan",
      );

      if (fnError) {
        // 단순 숫자가 아니라 진짜 HTTP 에러 객체인지 확인하고 429 골라냄
        if (fnError instanceof FunctionsHttpError) {
          const httpStatus = fnError.context?.status;
          if (httpStatus === 429) {
            console.log(
              "서버가 이미 생성 중입니다. 생성 중 모드로 전환합니다.",
            );
            setStatus("generating");
            return;
          }
        }
        throw fnError; // 진짜 찐 에러면 catch 블록으로 던져버림
      }

      // 2. 캐시 히트면 바로 데이터 박고 종료함
      if (data?.status === "cache_hit") {
        setPlan(data.data.plan_payload);
        setStatus("completed");
      } else {
        // 새로 생성 시작했거나 대기 중이면 생성 중 상태로 바꿈
        setStatus("generating");
      }
    } catch (err: any) {
      console.error("Edge Function 호출 에러:", err);
      setStatus("error");

      // Supabase 에러 종류 꼼꼼하게 따져서 메시지 쪼개줌
      if (err instanceof FunctionsHttpError) {
        const httpStatus = err.context?.status;
        let serverErrorMsg = "";

        // 엣지 함수가 뱉은 진짜 에러 바디(JSON) 파싱 일원화
        // 여기서만 한 번 파싱해서 서버가 내려준 진짜 에러 이유를 뽑아냄
        try {
          const body = await err.context.json();
          if (body?.error) serverErrorMsg = body.error;
        } catch (e) {
          // JSON 파싱 실패하면 무시함
        }

        if (httpStatus === 401) {
          setError("로그인이 만료되었습니다. 다시 로그인이 필요합니다.");
        } else if (httpStatus === 400) {
          setError(
            `입력 데이터 문제 발생: ${serverErrorMsg || "프로필 확인 요망"}`,
          );
        } else if (httpStatus && httpStatus >= 500) {
          setError(
            `AI 서버 오류 (${serverErrorMsg || "지연 됨"}). 재시도 해보세요.`,
          );
        } else {setError(
            `서버 에러 발생 (${httpStatus}). 잠시 후 다시 시도해보세요.`,
          );}
      } else if (err instanceof FunctionsRelayError) {
        // Relay 에러: Supabase Edge 네트워크 자체가 뻗었을 때
        setError("서버 연결에 실패함. 네트워크 상태 확인 요망.");
      } else if (err instanceof FunctionsFetchError) {
        // Fetch 에러: 유저 폰 인터넷이 끊겼을 때
        setError(
          "서버로 요청을 보내지 못했습니다. 와이파이나 데이터가 켜져있는지 확인해주세요.",
        );
      } else {
        // 그 외 알 수 없는 에러들
        setError("추천 플랜을 가져오지 못했습니다. 알 수 없는 에러입니다.");
      }
    }
  }, [userId]);

  useEffect(() => {
    // 유저 바뀌면 찌꺼기 안 남게 싹 비움
    if (!userId) {
      setPlan(null);
      setError(null);
      setStatus("idle");
      return;
    }

    let isMounted = true;
    fetchPlan();

    // 폴백(Fallback) 로직을 함수로 뺐음.
    // 15초 뒤에 부르거나, 웹소켓 터졌을 때 즉시 부르려고 분리함.
    const executeFallback = async () => {
      // status 대신 항상 최신 상태를 담고 있는 statusRef.current를 까봄
      // 이렇게 안 하면 플랜 다 만들어졌는데도 옛날 status 기억하고 헛짓거리함
      if (
        !isMounted || statusRef.current === "completed" ||
        statusRef.current === "error"
      ) return;

      console.log(
        "리얼타임 응답이 없거나 채널이 끊겼습니다. 직접 DB 조회를 시도합니다 (Fallback).",
      );

      // 폴백 조회 자체가 실패하는 경우(네트워크 단절 등)의 error까지 잡아냄
      const { data, error: fallbackErr } = await supabase
        .from("ai_plans")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackErr && isMounted) {
        console.error("폴백 DB 조회 중 에러 발생:", fallbackErr);
        setError(
          "데이터를 동기화하는 중 문제가 발생했습니다. 네트워크를 확인해주세요.",
        );
        setStatus("error");
        return;
      }

      if (data && isMounted) {
        if (data.status === "completed") {
          setPlan(data.plan_payload);
          setStatus("completed");
        } else if (data.status === "failed") {
          setError(data.error_message || "플랜 생성 실패가 확인되었습니다.");
          setStatus("error");
        }
      }
    };

    // 3. 리얼타임 구독해서 DB 업데이트 감시함
    const channel = supabase
      .channel(`plan_updates_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ai_plans",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!isMounted) return;

          const newRecord = payload.new;
          if (newRecord.status === "completed") {
            console.log("AI 플랜 생성이 완료 됐습니다. ");
            setPlan(newRecord.plan_payload);
            setStatus("completed");
          } else if (newRecord.status === "failed") {
            setError(
              newRecord.error_message || "AI가 플랜 생성에 실패했습니다.",
            );
            setStatus("error");
          }
        },
      )
      // 구독 상태(subStatus) 감시해서 문제 생기면 15초 안 기다리고 바로 폴백 때림
      .subscribe((subStatus, err) => {
        if (err) {
          console.error("리얼타임 구독 에러 발생:", err);
        }
        // CLOSED 상태도 추가해서 채널 완전히 죽었을 때도 바로 폴백 때리게 만듦
        if (
          subStatus === "CHANNEL_ERROR" || subStatus === "TIMED_OUT" ||
          subStatus === "CLOSED"
        ) {
          console.warn(
            `리얼타임 연결 문제 발생 (${subStatus}). 폴백 로직을 즉시 실행합니다.`,
          );
          executeFallback();
        }
      });

    // 기본적으로 15초 넘게 로딩 돌면 직접 DB 찔러보는 폴백 타이머 켬
    const fallbackTimer = setTimeout(executeFallback, 15000);

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
      supabase.removeChannel(channel);
    };
  }, [userId, fetchPlan]);

  // UI 컴포넌트에서 쓰기 좋게 plan, status, error 리턴하고
  // 재시도할 때 화면 안 깜빡거리게 isRetry = true 옵션 넣어서 묶어줌
  return {
    plan,
    status,
    error,
    retry: () => fetchPlan(true),
  };
}
