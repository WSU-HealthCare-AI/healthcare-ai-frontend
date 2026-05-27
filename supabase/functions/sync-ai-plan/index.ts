/* eslint-disable */
// deno-lint-ignore-file no-explicit-any no-import-prefix
// cspell:disable

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// CORS 에러 방지용 헤더 (앱이나 웹에서 찌를 때 이거 없으면 튕김)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 클라이언트가 응답을 완벽하게 파싱할 수 있도록 Content-Type 추가
const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

// 프롬프트나 로직 바뀌었을 때 이 버전을 올리면 기존 캐시를 무시하고 새로 생성을 강제함
const PLAN_VERSION = "v1.7.9";

// 매직 넘버(Magic Number) 분리: 정책이 바뀌면 여기 숫자만 바꾸면 됨 (유지보수 극대화)
const AI_POLICY = {
  CALORIE_MIN: 1000,
  CALORIE_MAX: 4000,
  MACRO_TOLERANCE_MIN: 90,
  MACRO_TOLERANCE_MAX: 110, // AI가 90~110% 사이로 틀렸을 때만 자가 치유 허용
  SETS_MIN: 1,
  SETS_MAX: 5,
  REST_SEC_MIN: 0,
  REST_SEC_MAX: 300,
};

// 에러/치유 추적을 위한 엄격한 유니온 타입 (오타 방지 및 모니터링 쿼리 용이성 확보)
type ErrorPhase =
  | "AUTH"
  | "DB"
  | "LLM"
  | "PARSE"
  | "VALIDATION"
  | "SYSTEM"
  | "CONFIG";

type ErrorReason =
  | "DAY_ORDER_INVALID"
  | "REST_DAY_VIOLATION"
  | "MISSING_EXERCISES"
  | "MACROS_OUT_OF_BOUNDS"
  | "MACROS_ZERO_OR_LESS"
  | "MACROS_NEGATIVE_AFTER_NORM"
  | "ZERO_WORKOUT_DAYS"
  | "FORBIDDEN_EXERCISE"
  | "MISSING_MEALS"
  | "INVALID_HEADER"
  | "USER_NOT_FOUND"
  | "RPC_FAILED"
  | "FETCH_FAILED"
  | "API_ERROR_RESPONSE"
  | "EMPTY_RESPONSE"
  | "INVALID_JSON"
  | "UPDATE_FAILED"
  | "MISSING_ENV_VAR";

type HealReason = "CLAMP_TO_MAX" | "SYNC_WITH_ROUTINE" | "RENORMALIZED_MACROS";

// 프론트엔드와 모니터링 시스템이 읽기 좋은 기계 친화적(Machine-friendly) 에러 규격
interface StructuredErrorDetails {
  phase?: ErrorPhase;
  reason?: ErrorReason | HealReason | string;
  field?: string;
  expected?: unknown;
  actual?: unknown;
  rawMessage?: string;
  [key: string]: unknown;
}

// 에러 종류를 명확하게 나누고 디테일을 담기 위해 커스텀 에러 클래스 정의
class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: StructuredErrorDetails,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// 데이터 정규화 헬퍼 함수
// 무조건 string[] 배열 형태로 만들어서 로직(.includes 등)과 프롬프트 모두 안전하게 만듦
const normalizeToArray = (data: any): string[] => {
  if (data == null || data === "") return []; // null, undefined 명확히 체크
  if (Array.isArray(data)) return data.map(String);

  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch (e) {}
    // 파싱 실패하면 쉼표 단위로 쪼개봄 (예: "체중감량, 근력증가")
    return data.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [String(data)];
};

serve(async (req: Request) => {
  // 브라우저가 본 요청 보내기 전에 찔러보는 OPTIONS 요청은 가볍게 ok 뱉고 컷함
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 환경변수에서 Supabase 키들 꺼내옴 (Service 키는 RLS 무시하는 강력한 관리자 권한임)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // 클라이언트가 보낸 토큰 꺼내옴. 없으면 바로 에러 던짐
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("AUTH_ERROR", "Invalid Authorization header format", {
        phase: "AUTH",
        reason: "INVALID_HEADER",
      });
    }
    // "Bearer " 글자를 떼어내고 순수 토큰(JWT) 문자열만 안전하게 추출함
    const jwtToken = authHeader.slice(7);

    // Edge 환경에 맞게 불필요한 세션 관리 기능 비활성화
    const supabaseServerOptions = {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    };

    // 토큰 얹은 일반 유저 클라이언트랑, 강제로 DB에 밀어넣을 관리자 클라이언트 2개 만듦
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      ...supabaseServerOptions,
    });
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      supabaseServerOptions,
    );

    // 클라이언트가 보낸 ID 안 믿음. 토큰 까서 진짜 유저 ID 직접 알아냄
    const { data: { user }, error: authError } = await supabaseUser.auth
      .getUser(jwtToken);
    if (authError || !user) {
      throw new AppError("AUTH_ERROR", "Unauthorized", {
        phase: "AUTH",
        reason: "USER_NOT_FOUND",
        rawMessage: authError?.message,
      });
    }
    const userId = user.id;

    // 프로필이랑 인바디 데이터 병렬로 땡겨옴. 인바디는 없을 수도 있어서 maybeSingle() 씀
    const [profileRes, inbodyRes] = await Promise.all([
      supabaseUser.from("health_profiles").select("*").eq("user_id", userId)
        .single(),
      supabaseUser.from("inbody_records").select("*").eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (profileRes.error) {
      throw new AppError("DB_ERROR", "Failed to fetch profile", {
        phase: "DB",
        field: "health_profiles",
        rawMessage: profileRes.error.message,
      });
    }
    if (inbodyRes.error) {
      throw new AppError("DB_ERROR", "Failed to fetch inbody records", {
        phase: "DB",
        field: "inbody_records",
        rawMessage: inbodyRes.error.message,
      });
    }

    const profile = profileRes.data;
    const inbody = inbodyRes.data || {};

    // DB에서 꺼낸 데이터 중 빵꾸난 거(null/undefined)를 무조건 배열(Array)로 정규화해서 방어막 침
    const safeProfile = {
      purposes: normalizeToArray(profile.purposes),
      diseases: normalizeToArray(profile.diseases),
      pain_points: normalizeToArray(profile.pain_points),
    };
    const safeInbody = {
      body_fat_percentage: inbody.body_fat_percentage ?? "알 수 없음",
      skeletal_muscle_mass_kg: inbody.skeletal_muscle_mass_kg ?? "알 수 없음",
    };

    // 입력 데이터 다 뭉쳐서 SHA-256 해시 만듦. 1글자라도 다르면 해시값 확 바뀜 (멱등성 보장의 핵심)
    const rawDataString = JSON.stringify({
      profile: safeProfile,
      inbody: safeInbody,
      version: PLAN_VERSION,
    });
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(rawDataString),
    );
    const inputHash = Array.from(new Uint8Array(hashBuffer)).map((b) =>
      b.toString(16).padStart(2, "0")
    ).join("");

    // DB에 락(Lock) 걸어서 연타 방지하고, 진행 상태(pending) 빈 껍데기 먼저 꽂아넣음
    const { data: lockResult, error: lockError } = await supabaseAdmin.rpc(
      "create_pending_plan_with_lock",
      { p_user_id: userId, p_input_hash: inputHash },
    );

    if (lockError) {
      throw new AppError("DB_ERROR", "RPC Error", {
        phase: "DB",
        reason: "RPC_FAILED",
        rawMessage: lockError.message,
      });
    }

    // 이미 누가 락 걸고 진행 중이면 429 에러 뱉고 컷함 (클라이언트는 그냥 스켈레톤 보면서 대기함)
    if (lockResult.status === "locked") {
      return new Response(
        JSON.stringify({
          status: "locked",
          message: "Processing already in progress",
        }),
        { status: 429, headers: jsonHeaders },
      );
    }

    // 이미 똑같은 해시로 성공한 결과(캐시) 있으면 그거 그냥 던져줌
    if (lockResult.status === "cache_hit") {
      return new Response(
        JSON.stringify({ status: "cache_hit", data: lockResult.data }),
        { status: 200, headers: jsonHeaders },
      );
    }

    // 여기까지 왔으면 진짜 AI 호출해야 함.
    const planId = lockResult.plan_id;
    const startTime = Date.now();

    // AI가 실수하고 우리가 몰래 고쳐준(Self-Healing) 내역을 모아두는 배열 (나중에 통계 분석용)
    const healedEvents: Array<
      {
        field: string;
        reason: HealReason;
        originalValue: any;
        healedValue: any;
      }
    > = [];

    try {
      // 기저질환/통증 유연한 텍스트 매칭 (한국어/대소문자 포함)
      const isDiscPatient = safeProfile.diseases.some((d) =>
        d.toLowerCase().includes("disk") || d.toLowerCase().includes("disc") ||
        d.toLowerCase().includes("디스크")
      );
      const hasKneePain = safeProfile.pain_points.some((p) =>
        p.toLowerCase().includes("knee") || p.toLowerCase().includes("무릎")
      );

      // 금지 단어를 배열로 관리하여 유연하게 잡도록 개선
      const forbiddenWords: string[] = [];
      if (isDiscPatient) {
        forbiddenWords.push("Sit-up", "Deadlift", "Kettlebell Swing");
      }
      if (hasKneePain) forbiddenWords.push("Jump Squat", "Burpee", "Lunge");

      const hardConstraints = {
        maxIntensity: isDiscPatient ? 2 : (hasKneePain ? 3 : 5),
        forbiddenRegex: forbiddenWords.map((word) => new RegExp(word, "i")),
      };
      const forbiddenNames = forbiddenWords.length > 0
        ? forbiddenWords.join(", ")
        : "없음";

      // 프롬프트 역할 명확화: 형식 제약(문법)은 스키마에 맡기고, 여기선 논리적/의미적 중요성만 강조
      const systemPrompt = `
      당신은 세계 최고의 임상 운동 전문가이자 영양사입니다. 사용자의 건강 데이터를 바탕으로 100% 맨몸 운동 기반의 안전한 플랜을 JSON으로만 응답하세요.
      
      [의미적 가드레일 - 절대 준수]
      1. 운동 강도는 절대 무리하지 않게 설정하세요. 현재 최대 허용 강도는 ${hardConstraints.maxIntensity}(1~5 기준)입니다.
      2. 금지된 운동(${forbiddenNames})은 대체 운동으로 완벽히 치환하세요.
      3. 'weekly_routine'에서 운동하는 날의 수는 사용자의 체력에 맞게 산정된 'weekly_frequency'와 정확히 일치해야 합니다. 휴식일에는 철저히 휴식에 집중할 수 있도록 운동을 비워주세요.
      4. [중요] 특정 요일(월~일)에 종속되지 않는 범용적인 루틴이어야 합니다. day 1은 사용자가 플랜을 시작하는 '1일차'를 의미하며, day 7까지 매일 순차적으로 진행할 수 있도록 설계하세요.
      `;

      // 실제 유저 데이터 조립
      const userPrompt = `
      [사용자 데이터]
      - 목적: ${safeProfile.purposes.join(", ") || "없음"}
      - 질환: ${safeProfile.diseases.join(", ") || "없음"}
      - 체지방률: ${safeInbody.body_fat_percentage}%
      - 골격근량: ${safeInbody.skeletal_muscle_mass_kg}kg
      `;

      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      // 인프라 문제(API 키 누락)를 단순 에러와 분리하여 'CONFIG' Phase로 관제 가능하게 함
      if (!GEMINI_API_KEY) {
        throw new AppError("CONFIG_ERROR", "Missing Gemini API Key", {
          phase: "CONFIG",
          reason: "MISSING_ENV_VAR",
        });
      }

      let geminiRes;
      try {
        // Gemini API 호출 (Schema 강제)
        geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ parts: [{ text: userPrompt }] }],
              generationConfig: {
                temperature: 0.1, // 헛소리 방지용
                responseMimeType: "application/json",
                responseSchema: getResponseSchema(hardConstraints.maxIntensity),
              },
            }),
          },
        );
      } catch (fetchError: any) {
        throw new AppError("NETWORK_ERROR", `Failed to connect to Gemini API`, {
          phase: "LLM",
          reason: "FETCH_FAILED",
          rawMessage: fetchError.message,
        });
      }

      if (!geminiRes.ok) {
        const errorText = await geminiRes.text();
        throw new AppError(
          "LLM_ERROR",
          `Gemini API Error: ${geminiRes.status}`,
          {
            phase: "LLM",
            reason: "API_ERROR_RESPONSE",
            actual: geminiRes.status,
            rawMessage: errorText.slice(0, 500),
          },
        );
      }

      const geminiData = await geminiRes.json();
      const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]
        ?.text;
      if (!responseText) {
        throw new AppError("LLM_ERROR", "Empty response from Gemini", {
          phase: "LLM",
          reason: "EMPTY_RESPONSE",
        });
      }

      let planPayload;
      try {
        planPayload = JSON.parse(responseText);
      } catch (parseError: any) {
        throw new AppError("PARSE_ERROR", `Failed to parse JSON response`, {
          phase: "PARSE",
          reason: "INVALID_JSON",
          rawMessage: parseError.message,
        });
      }

      // ---------------- 2차 비즈니스 룰 검증 및 자가 치유(Self-Healing) ----------------
      // LLM이 헛소리했는지 우리가 직접 깐깐하게 검사하고, 살릴 수 있는 건 살림
      try {
        // 1. 강도 초과 시 자가 치유 (Clamping) - 최대치로 깎아버림
        if (planPayload.workout_plan.intensity > hardConstraints.maxIntensity) {
          healedEvents.push({
            field: "workout_plan.intensity",
            reason: "CLAMP_TO_MAX",
            originalValue: planPayload.workout_plan.intensity,
            healedValue: hardConstraints.maxIntensity,
          });
          planPayload.workout_plan.intensity = hardConstraints.maxIntensity;
        }

        if (
          planPayload.workout_plan.weekly_frequency < 1 ||
          planPayload.workout_plan.weekly_frequency > 7
        ) {
          throw new AppError("VALIDATION_ERROR", "Frequency out of bounds", {
            phase: "VALIDATION",
            field: "weekly_frequency",
            expected: "1~7",
            actual: planPayload.workout_plan.weekly_frequency,
          });
        }

        if (
          !Array.isArray(planPayload.workout_plan.weekly_routine) ||
          planPayload.workout_plan.weekly_routine.length !== 7
        ) {
          throw new AppError("VALIDATION_ERROR", "Routine length invalid", {
            phase: "VALIDATION",
            field: "weekly_routine",
            expected: 7,
            actual: planPayload.workout_plan.weekly_routine?.length,
          });
        }

        let workoutDaysCount = 0;

        // Day 무결성 및 휴식일 Exercises 빈 배열 검증, 운동일수 정합성 체크
        planPayload.workout_plan.weekly_routine.forEach(
          (dayPlan: any, idx: number) => {
            if (dayPlan.day !== idx + 1) {
              throw new AppError("VALIDATION_ERROR", "Day order invalid", {
                phase: "VALIDATION",
                field: `weekly_routine[${idx}].day`,
                expected: idx + 1,
                actual: dayPlan.day,
              });
            }

            if (dayPlan.is_rest_day) {
              if (
                Array.isArray(dayPlan.exercises) && dayPlan.exercises.length > 0
              ) {
                throw new AppError(
                  "VALIDATION_ERROR",
                  "Rest day has exercises",
                  {
                    phase: "VALIDATION",
                    field: `weekly_routine[${idx}].exercises`,
                    reason: "REST_DAY_VIOLATION",
                  },
                );
              }
            } else {
              workoutDaysCount++;
              if (
                !Array.isArray(dayPlan.exercises) ||
                dayPlan.exercises.length === 0
              ) {
                throw new AppError(
                  "VALIDATION_ERROR",
                  "Active day missing exercises",
                  {
                    phase: "VALIDATION",
                    field: `weekly_routine[${idx}].exercises`,
                    reason: "MISSING_EXERCISES",
                  },
                );
              }

              dayPlan.exercises.forEach((ex: any, exIdx: number) => {
                if (
                  ex.sets < AI_POLICY.SETS_MIN || ex.sets > AI_POLICY.SETS_MAX
                ) {
                  throw new AppError("VALIDATION_ERROR", "Invalid sets", {
                    phase: "VALIDATION",
                    field: `exercises[${exIdx}].sets`,
                    expected: `${AI_POLICY.SETS_MIN}~${AI_POLICY.SETS_MAX}`,
                    actual: ex.sets,
                  });
                }
                if (
                  ex.rest_sec < AI_POLICY.REST_SEC_MIN ||
                  ex.rest_sec > AI_POLICY.REST_SEC_MAX
                ) {
                  throw new AppError("VALIDATION_ERROR", "Invalid rest_sec", {
                    phase: "VALIDATION",
                    field: `exercises[${exIdx}].rest_sec`,
                    expected:
                      `${AI_POLICY.REST_SEC_MIN}~${AI_POLICY.REST_SEC_MAX}`,
                    actual: ex.rest_sec,
                  });
                }

                const hasForbidden = hardConstraints.forbiddenRegex.some((
                  regex,
                ) => regex.test(ex.name));
                if (hasForbidden) {
                  throw new AppError("VALIDATION_ERROR", "Forbidden exercise", {
                    phase: "VALIDATION",
                    field: `exercises[${exIdx}].name`,
                    reason: "FORBIDDEN_EXERCISE",
                    actual: ex.name,
                  });
                }
              });
            }
          },
        );

        // 2. 빈도수 자가 치유 - AI가 말한 횟수랑 실제 루틴 일수가 다르면 실제 루틴 기준으로 덮어씌움
        if (workoutDaysCount !== planPayload.workout_plan.weekly_frequency) {
          if (workoutDaysCount === 0) {
            throw new AppError(
              "VALIDATION_ERROR",
              "Zero workout days generated",
              {
                phase: "VALIDATION",
                field: "weekly_routine",
                reason: "ZERO_WORKOUT_DAYS",
              },
            );
          }
          healedEvents.push({
            field: "workout_plan.weekly_frequency",
            reason: "SYNC_WITH_ROUTINE",
            originalValue: planPayload.workout_plan.weekly_frequency,
            healedValue: workoutDaysCount,
          });
          planPayload.workout_plan.weekly_frequency = workoutDaysCount;
        }

        if (
          planPayload.calorie_guide < AI_POLICY.CALORIE_MIN ||
          planPayload.calorie_guide > AI_POLICY.CALORIE_MAX
        ) {
          throw new AppError(
            "VALIDATION_ERROR",
            "Calorie guide out of bounds",
            {
              phase: "VALIDATION",
              field: "calorie_guide",
              expected: `${AI_POLICY.CALORIE_MIN}~${AI_POLICY.CALORIE_MAX}`,
              actual: planPayload.calorie_guide,
            },
          );
        }

        // 3. 매크로 영양소 자가 치유 (Normalization) - 100%가 아니어도 허용 오차 내면 비율 꽉 채워줌
        let carbs = planPayload.macro_guide.carbs_pct;
        let protein = planPayload.macro_guide.protein_pct;
        let fat = planPayload.macro_guide.fat_pct;
        const totalMacros = carbs + protein + fat;

        if (totalMacros !== 100) {
          if (totalMacros <= 0) {
            throw new AppError(
              "VALIDATION_ERROR",
              "Macros sum is zero or negative",
              {
                phase: "VALIDATION",
                field: "macro_guide",
                reason: "MACROS_ZERO_OR_LESS",
                actual: totalMacros,
              },
            );
          }

          if (
            totalMacros >= AI_POLICY.MACRO_TOLERANCE_MIN &&
            totalMacros <= AI_POLICY.MACRO_TOLERANCE_MAX
          ) {
            carbs = Math.round((carbs / totalMacros) * 100);
            protein = Math.round((protein / totalMacros) * 100);
            fat = 100 - (carbs + protein);

            // 반올림 후 음수가 되는 기상천외한 케이스 방어
            if (carbs < 0 || protein < 0 || fat < 0) {
              throw new AppError(
                "VALIDATION_ERROR",
                "Normalization resulted in negative macros",
                {
                  phase: "VALIDATION",
                  field: "macro_guide",
                  reason: "MACROS_NEGATIVE_AFTER_NORM",
                },
              );
            }

            healedEvents.push({
              field: "macro_guide",
              reason: "RENORMALIZED_MACROS",
              originalValue: totalMacros,
              healedValue: 100,
            });
            planPayload.macro_guide.carbs_pct = carbs;
            planPayload.macro_guide.protein_pct = protein;
            planPayload.macro_guide.fat_pct = fat;
          } else {
            throw new AppError(
              "VALIDATION_ERROR",
              "Macro error too large to heal",
              {
                phase: "VALIDATION",
                field: "macro_guide",
                reason: "MACROS_OUT_OF_BOUNDS",
                expected: 100,
                actual: totalMacros,
              },
            );
          }
        }

        // 식단 검증
        if (
          !Array.isArray(planPayload.weekly_diet_plan) ||
          planPayload.weekly_diet_plan.length !== 7
        ) {
          throw new AppError("VALIDATION_ERROR", "Diet plan length invalid", {
            phase: "VALIDATION",
            field: "weekly_diet_plan",
            expected: 7,
            actual: planPayload.weekly_diet_plan?.length,
          });
        }

        planPayload.weekly_diet_plan.forEach((diet: any, idx: number) => {
          if (diet.day !== idx + 1) {
            throw new AppError("VALIDATION_ERROR", "Diet day order invalid", {
              phase: "VALIDATION",
              field: `weekly_diet_plan[${idx}].day`,
              expected: idx + 1,
              actual: diet.day,
            });
          }
          if (!diet.breakfast || !diet.lunch || !diet.dinner) {
            throw new AppError("VALIDATION_ERROR", "Missing required meals", {
              phase: "VALIDATION",
              field: `weekly_diet_plan[${idx}]`,
              reason: "MISSING_MEALS",
            });
          }
        });
      } catch (validationError: any) {
        // 이미 우리가 촘촘하게 만든 AppError면 그대로 뱉고, 예측 못한 에러만 새로 포장함 (에러 디테일 보존)
        if (validationError instanceof AppError) {
          throw validationError;
        }
        throw new AppError(
          "VALIDATION_ERROR",
          "플랜 데이터 유효성 검사 중 알 수 없는 에러 발생",
          { phase: "VALIDATION", rawMessage: validationError.message },
        );
      }

      // 검증 다 통과했으면 토큰 얼마나 썼고 시간 얼마나 걸렸는지 정산
      const latency = Date.now() - startTime;
      const inputTokens = geminiData.usageMetadata?.promptTokenCount || 0;
      const outputTokens = geminiData.usageMetadata?.candidatesTokenCount || 0;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString();

      // 🚀 [추가] 성공 시에는 status: 'healed'를 명시하여, 실패 로그와 DB에서 완벽하게 분리되도록 저장
      const successLogPayload = healedEvents.length > 0
        ? { status: "healed", healed_events: healedEvents }
        : null;

      // ---------------- DB 업데이트 (성공) ----------------
      const { error: updateError } = await supabaseAdmin.from("ai_plans")
        .update({
          status: "completed",
          plan_payload: planPayload,
          plan_version: PLAN_VERSION,
          model_name: "gemini-2.5-flash",
          latency_ms: latency,
          token_usage_input: inputTokens,
          token_usage_output: outputTokens,
          expires_at: expiresAt,
          error_details: successLogPayload,
          completed_at: new Date().toISOString(),
        }).eq("id", planId);

      if (updateError) {
        throw new AppError("DB_UPDATE_ERROR", `Failed to save completed plan`, {
          phase: "DB",
          reason: "UPDATE_FAILED",
          rawMessage: updateError.message,
        });
      }

      return new Response(
        JSON.stringify({ status: "created", plan_id: planId }),
        { status: 200, headers: jsonHeaders },
      );
    } catch (err: unknown) {
      // ---------------- 내부 에러 처리 ----------------
      let errorCode = "INTERNAL_ERROR";
      let errorMessage = "An unexpected error occurred";
      let errorDetails = undefined;

      if (err instanceof AppError) {
        errorCode = err.code;
        errorMessage = err.message;
        errorDetails = err.details;
      } else if (err instanceof Error) errorMessage = err.message;

      // 🚀 [추가] 실패 시에는 어떤 놈이 들어오든 무조건 뒤에 status: 'failed'를 덮어씌워서 강제함
      const failedDetails = { ...(errorDetails || {}), status: "failed" };

      await supabaseAdmin.from("ai_plans").update({
        status: "failed",
        error_code: errorCode,
        error_message: errorMessage,
        error_details: failedDetails,
        failed_at: new Date().toISOString(),
      }).eq("id", planId);

      throw err;
    }
  } catch (err: unknown) {
    // ---------------- 최상위 에러 처리 (클라이언트 응답용) ----------------
    // 에러 종류별로 HTTP 상태 코드 예쁘게 나눠서 클라이언트한테 던져줌
    let statusCode = 500;
    let errorCode = "INTERNAL_ERROR";
    let errorMessage = "Internal Server Error";
    let errorDetails = undefined;

    if (err instanceof AppError) {
      errorCode = err.code;
      errorMessage = err.message;
      errorDetails = err.details;

      if (err.code === "AUTH_ERROR") statusCode = 401;
      else if (err.code === "PARSE_ERROR") statusCode = 400; // 단순 파싱 에러는 400
      else if (err.code === "VALIDATION_ERROR") statusCode = 422; // 도메인 규칙 위반은 422 Unprocessable Entity
      else if (err.code === "NETWORK_ERROR" || err.code === "LLM_ERROR") {
        statusCode = 502;
      }
    } else if (err instanceof Error) {
      errorMessage = err.message;
    }

    // 클라이언트가 파싱하기 쉽고 로깅에 유용한 구조화된 JSON 페이로드 반환
    return new Response(
      JSON.stringify({
        error: {
          code: errorCode,
          message: errorMessage,
          details: errorDetails,
        },
      }),
      { status: statusCode, headers: jsonHeaders },
    );
  }
});

// Gemini Structured Output용 스키마 정의함
function getResponseSchema(maxIntensity: number) {
  return {
    type: "OBJECT",
    properties: {
      medical_disclaimer: { type: "STRING" },
      risk_flags: { type: "ARRAY", items: { type: "STRING" } },
      summary: { type: "STRING" },
      calorie_guide: {
        type: "INTEGER",
        minimum: AI_POLICY.CALORIE_MIN,
        maximum: AI_POLICY.CALORIE_MAX,
      },
      macro_guide: {
        type: "OBJECT",
        properties: {
          carbs_pct: { type: "INTEGER", minimum: 0, maximum: 100 },
          protein_pct: { type: "INTEGER", minimum: 0, maximum: 100 },
          fat_pct: { type: "INTEGER", minimum: 0, maximum: 100 },
        },
        required: ["carbs_pct", "protein_pct", "fat_pct"],
      },
      weekly_diet_plan: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            day: { type: "INTEGER", minimum: 1, maximum: 7 },
            breakfast: { type: "STRING" },
            lunch: { type: "STRING" },
            dinner: { type: "STRING" },
            snack: { type: "STRING" },
          },
          required: ["day", "breakfast", "lunch", "dinner"],
        },
      },
      workout_plan: {
        type: "OBJECT",
        properties: {
          weekly_frequency: { type: "INTEGER", minimum: 1, maximum: 7 },
          intensity: { type: "INTEGER", minimum: 1, maximum: maxIntensity },
          weekly_routine: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                day: { type: "INTEGER", minimum: 1, maximum: 7 },
                is_rest_day: { type: "BOOLEAN" },
                daily_target: { type: "STRING" },
                exercises: {
                  type: "ARRAY",
                  minItems: 0,
                  maxItems: 8,
                  items: {
                    type: "OBJECT",
                    properties: {
                      name: { type: "STRING" },
                      reason: { type: "STRING" },
                      sets: {
                        type: "INTEGER",
                        minimum: AI_POLICY.SETS_MIN,
                        maximum: AI_POLICY.SETS_MAX,
                      },
                      reps: { type: "STRING" },
                      rest_sec: {
                        type: "INTEGER",
                        minimum: AI_POLICY.REST_SEC_MIN,
                        maximum: AI_POLICY.REST_SEC_MAX,
                      },
                      cautions: { type: "STRING" },
                    },
                    required: [
                      "name",
                      "reason",
                      "sets",
                      "reps",
                      "rest_sec",
                      "cautions",
                    ],
                  },
                },
              },
              required: ["day", "is_rest_day", "daily_target", "exercises"],
            },
          },
        },
        required: ["weekly_frequency", "intensity", "weekly_routine"],
      },
    },
    required: [
      "medical_disclaimer",
      "risk_flags",
      "summary",
      "calorie_guide",
      "macro_guide",
      "weekly_diet_plan",
      "workout_plan",
    ],
  };
}
