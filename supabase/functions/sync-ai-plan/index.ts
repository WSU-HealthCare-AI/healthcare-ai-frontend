/* eslint-disable */
// deno-lint-ignore-file no-explicit-any no-import-prefix
// cspell:disable

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// CORS 에러 방지용 헤더임 (앱이나 웹에서 찌를 때 이거 없으면 튕김)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 프롬프트나 로직 바뀌었을 때 이 버전 올리면 기존 캐시 무시하고 새로 만듦
const PLAN_VERSION = "v1.5.1";

// 에러 종류 명확하게 나누려고 커스텀 에러 클래스 하나 파둠
class AppError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "AppError";
  }
}

serve(async (req: Request) => {
  // 브라우저가 본 요청 보내기 전에 찔러보는 OPTIONS 요청은 가볍게 ok 뱉고 컷함
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 환경변수에서 Supabase 키들 꺼내옴 (Service 키는 RLS 무시하는 관리자 권한임)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // 클라이언트가 보낸 토큰 꺼내옴. 없으면 바로 에러 던짐
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new AppError("AUTH_ERROR", "Missing Authorization header");
    }

    // 토큰 얹은 일반 유저 클라이언트랑, 강제로 DB에 밀어넣을 관리자 클라이언트 2개 만듦
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 클라이언트가 보낸 ID 안 믿음. 토큰 까서 진짜 유저 ID 직접 알아냄
    const { data: { user }, error: authError } = await supabaseUser.auth
      .getUser();
    if (authError || !user) throw new AppError("AUTH_ERROR", "Unauthorized");
    const userId = user.id;

    // 프로필이랑 인바디 데이터 병렬로 땡겨옴. 인바디는 없을 수도 있어서 maybeSingle() 씀
    const [profileRes, inbodyRes] = await Promise.all([
      supabaseUser.from("health_profiles").select("*").eq("user_id", userId)
        .single(),
      supabaseUser.from("inbody_records").select("*").eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (profileRes.error) {
      throw new AppError("DB_ERROR", "Failed to fetch profile");
    }
    const profile = profileRes.data;
    const inbody = inbodyRes.data || {};

    // DB에서 꺼낸 데이터 중 빵꾸난 거(null/undefined) 기본값으로 채워서 방어막 침
    const safeProfile = {
      purposes: profile.purposes || [],
      diseases: profile.diseases || [],
      pain_points: profile.pain_points || [],
    };
    const safeInbody = {
      body_fat_percentage: inbody.body_fat_percentage ?? "알 수 없음",
      skeletal_muscle_mass_kg: inbody.skeletal_muscle_mass_kg ?? "알 수 없음",
    };

    // 입력 데이터 다 뭉쳐서 SHA-256 해시 만듦. 1글자라도 다르면 해시값 확 바뀜 (멱등성 핵심)
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
      {
        p_user_id: userId,
        p_input_hash: inputHash,
      },
    );

    if (lockError) {
      throw new AppError("DB_ERROR", `RPC Error: ${lockError.message}`);
    }

    // 이미 누가 락 걸고 진행 중이면 429 에러 뱉고 컷함 (클라이언트는 그냥 스켈레톤 보면서 대기함)
    if (lockResult.status === "locked") {
      return new Response(
        JSON.stringify({
          status: "locked",
          message: "Processing already in progress",
        }),
        { status: 429, headers: corsHeaders },
      );
    }
    // 이미 똑같은 해시로 성공한 결과(캐시) 있으면 그거 그냥 던져줌
    if (lockResult.status === "cache_hit") {
      return new Response(
        JSON.stringify({ status: "cache_hit", data: lockResult.data }),
        { headers: corsHeaders, status: 200 },
      );
    }

    // 여기까지 왔으면 진짜 AI 호출해야 함.
    const planId = lockResult.plan_id;
    const startTime = Date.now(); // 소요 시간 재려고 타이머 켬

    try {
      // 기저질환 보고 1차로 가드레일(제약사항) 세팅함
      const isDiscPatient = safeProfile.diseases.includes("disk");
      const hasKneePain = safeProfile.pain_points.includes("knee");

      const hardConstraints = {
        maxIntensity: isDiscPatient ? 2 : (hasKneePain ? 3 : 5),
        forbiddenRegex: [] as RegExp[], // 금지 운동은 빡세게 잡으려고 정규식으로 박아둠
      };

      if (isDiscPatient) {
        hardConstraints.forbiddenRegex.push(
          /^Sit-up$/i,
          /^Deadlift$/i,
          /^Kettlebell Swing$/i,
        );
      }
      if (hasKneePain) {
        hardConstraints.forbiddenRegex.push(
          /^Jump Squat$/i,
          /^Burpee$/i,
          /^Lunge$/i,
        );
      }

      // 프롬프트에 넣을 금지 운동 이름들 텍스트로 뽑아냄
      const forbiddenNames = hardConstraints.forbiddenRegex.map((r) =>
        r.source.replace(/\^|\$/g, "")
      ).join(", ");

      // Gemini한테 줄 시스템 프롬프트 (전문가 페르소나 + 절대 규칙 주입)
      const systemPrompt = `
      당신은 세계 최고의 임상 운동 전문가이자 영양사입니다. 사용자의 건강 데이터를 바탕으로 100% 맨몸 운동 기반의 안전한 플랜을 JSON으로만 응답하세요.
      
      [가드레일 제약사항 - 절대 준수]
      1. 최대 허용 운동 강도: ${hardConstraints.maxIntensity} (1~5 기준)
      2. 금지된 운동 목록: ${
        hardConstraints.forbiddenRegex.length > 0 ? forbiddenNames : "없음"
      }
      3. 탄/단/지 비율(pct)의 합은 반드시 100이 되어야 합니다.
      `;

      // 실제 유저 데이터 프롬프트로 조립함
      const userPrompt = `
      [사용자 데이터]
      - 목적: ${safeProfile.purposes.join(", ")}
      - 질환: ${safeProfile.diseases.join(", ")}
      - 체지방률: ${safeInbody.body_fat_percentage}%
      - 골격근량: ${safeInbody.skeletal_muscle_mass_kg}kg
      `;

      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      if (!GEMINI_API_KEY) {
        throw new AppError("CONFIG_ERROR", "Missing Gemini API Key");
      }

      let geminiRes;
      try {
        // Gemini API한테 JSON 형태로 대답하라고 요청 보냄 (Schema 강제)
        geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ parts: [{ text: userPrompt }] }],
              generationConfig: {
                temperature: 0.1, // 헛소리 방지하려고 창의성 확 낮춤
                responseMimeType: "application/json",
                responseSchema: getResponseSchema(hardConstraints.maxIntensity),
              },
            }),
          },
        );
      } catch (fetchError: any) {
        throw new AppError(
          "NETWORK_ERROR",
          `Failed to connect to Gemini API: ${fetchError.message}`,
        );
      }

      if (!geminiRes.ok) {
        throw new AppError(
          "LLM_ERROR",
          `Gemini API Error: ${geminiRes.statusText}`,
        );
      }
      const geminiData = await geminiRes.json();

      const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]
        ?.text;
      if (!responseText) {
        throw new AppError("LLM_ERROR", "Empty response from Gemini");
      }

      let planPayload;
      try {
        // 응답 텍스트 JSON으로 파싱함
        planPayload = JSON.parse(responseText);
      } catch (parseError: any) {
        throw new AppError(
          "PARSE_ERROR",
          `Failed to parse JSON response: ${parseError.message}`,
        );
      }

      // ---------------- 2차 비즈니스 룰 검증 ----------------
      // LLM이 지시 무시하고 헛소리 했는지 우리가 직접 한 번 더 깐깐하게 검사함
      try {
        // 1. 강도 상한선 넘었는지 컷
        if (planPayload.workout_plan.intensity > hardConstraints.maxIntensity) {
          throw new Error(
            `AI suggested intensity (${planPayload.workout_plan.intensity}) exceeds maximum allowed (${hardConstraints.maxIntensity})`,
          );
        }

        // 2. 주당 횟수랑 추천 운동 개수 상식적인지 컷
        if (
          planPayload.workout_plan.weekly_frequency < 1 ||
          planPayload.workout_plan.weekly_frequency > 7
        ) {
          throw new Error("Weekly frequency must be between 1 and 7");
        }
        if (
          !Array.isArray(planPayload.workout_plan.exercises) ||
          planPayload.workout_plan.exercises.length < 1 ||
          planPayload.workout_plan.exercises.length > 8
        ) {
          throw new Error("Exercises count must be between 1 and 8");
        }

        // 3. 운동 세부 항목 (세트, 휴식시간) 정상이랑 금지운동 교묘하게 넣었는지 정규식으로 싹 다 검사함
        planPayload.workout_plan.exercises.forEach((ex: any, idx: number) => {
          if (ex.sets < 1 || ex.sets > 5) {
            throw new Error(`Exercise ${idx + 1} sets must be between 1 and 5`);
          }
          if (ex.rest_sec < 0 || ex.rest_sec > 300) {
            throw new Error(
              `Exercise ${idx + 1} rest_sec must be between 0 and 300`,
            );
          }

          const hasForbidden = hardConstraints.forbiddenRegex.some((regex) =>
            regex.test(ex.name)
          );
          if (hasForbidden) {
            throw new Error(`Forbidden exercise included: ${ex.name}`);
          }
        });

        // 4. 칼로리 범위랑 탄단지 합 100% 맞는지 컷
        if (
          planPayload.calorie_guide < 1000 || planPayload.calorie_guide > 4000
        ) {
          throw new Error("Calorie guide must be between 1000 and 4000");
        }
        const totalMacros = planPayload.macro_guide.carbs_pct +
          planPayload.macro_guide.protein_pct + planPayload.macro_guide.fat_pct;
        if (totalMacros !== 100) {
          throw new Error(`Macros sum to ${totalMacros}, expected 100`);
        }
      } catch (validationError: any) {
        // 검증 통과 못했으면 바로 에러 던져버림
        throw new AppError("VALIDATION_ERROR", validationError.message);
      }

      // 검증 다 통과했으면 토큰 얼마나 썼고 시간 얼마나 걸렸는지 정산함
      const latency = Date.now() - startTime;
      const inputTokens = geminiData.usageMetadata?.promptTokenCount || 0;
      const outputTokens = geminiData.usageMetadata?.candidatesTokenCount || 0;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString(); // 만료일은 7일 뒤

      // ---------------- DB 업데이트 (성공) ----------------
      // 다 끝났으니 DB에 completed 상태로 싹 다 덮어씀
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
          completed_at: new Date().toISOString(),
        }).eq("id", planId);

      // DB 업데이트 실패하면 클라이언트한테 거짓말 치면 안 되니까 무조건 에러 던짐
      if (updateError) {
        throw new AppError(
          "DB_UPDATE_ERROR",
          `Failed to save completed plan: ${updateError.message}`,
        );
      }

      // 프론트한테는 '성공적으로 큐에 들어감/완료됨' 하고 200 ok 던짐
      return new Response(
        JSON.stringify({ status: "created", plan_id: planId }),
        { headers: corsHeaders, status: 200 },
      );
    } catch (err: unknown) {
      // ---------------- 내부 에러 처리 ----------------
      // LLM이 헛소리했거나 검증 통과 못했으면 상태를 failed로 롤백함
      let errorCode = "INTERNAL_ERROR";
      let errorMessage = "An unexpected error occurred";

      if (err instanceof AppError) {
        errorCode = err.code;
        errorMessage = err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      const { error: fallbackError } = await supabaseAdmin.from("ai_plans")
        .update({
          status: "failed",
          error_code: errorCode,
          error_message: errorMessage,
          failed_at: new Date().toISOString(),
        }).eq("id", planId);

      // 여기서 롤백 실패해도 상위 에러 덮어쓰면 안 되니까 로그만 찍음
      if (fallbackError) {
        console.error(
          "Failed to update status to 'failed':",
          fallbackError.message,
        );
      }

      throw err;
    }
  } catch (err: unknown) {
    // ---------------- 최상위 에러 처리 (클라이언트 응답용) ----------------
    // 에러 종류별로 HTTP 상태 코드 예쁘게 나눠서 클라이언트한테 던져줌
    let statusCode = 500;
    let errorMessage = "Internal Server Error";

    if (err instanceof AppError) {
      if (err.code === "AUTH_ERROR") statusCode = 401;
      else if (err.code === "VALIDATION_ERROR" || err.code === "PARSE_ERROR") {
        statusCode = 400;
      } else if (err.code === "NETWORK_ERROR" || err.code === "LLM_ERROR") {
        statusCode = 502;
      } else statusCode = 500;

      errorMessage = err.message;
    } else if (err instanceof Error) {
      errorMessage = err.message;
    }

    console.error("Edge Function Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: statusCode,
      headers: corsHeaders,
    });
  }
});

// Gemini Structured Output용 스키마 정의함. minimum/maximum 빡세게 걸어둠
function getResponseSchema(maxIntensity: number) {
  return {
    type: "OBJECT",
    properties: {
      medical_disclaimer: { type: "STRING" },
      risk_flags: {
        type: "ARRAY",
        items: { type: "STRING" },
        minItems: 0,
        maxItems: 5,
      },
      summary: { type: "STRING" },
      calorie_guide: {
        type: "INTEGER",
        description: "권장 총 섭취 칼로리 (최소 1000, 최대 4000)",
        minimum: 1000,
        maximum: 4000,
      },
      macro_guide: {
        type: "OBJECT",
        additionalProperties: false, // 딴짓거리 속성 못 만들게 차단
        properties: {
          carbs_pct: { type: "INTEGER", minimum: 0, maximum: 100 },
          protein_pct: { type: "INTEGER", minimum: 0, maximum: 100 },
          fat_pct: { type: "INTEGER", minimum: 0, maximum: 100 },
        },
        required: ["carbs_pct", "protein_pct", "fat_pct"],
      },
      workout_plan: {
        type: "OBJECT",
        additionalProperties: false,
        properties: {
          weekly_frequency: {
            type: "INTEGER",
            description: "주당 운동 횟수 (1~7)",
            minimum: 1,
            maximum: 7,
          },
          intensity: {
            type: "INTEGER",
            description: `운동 강도 (최대 ${maxIntensity})`,
            minimum: 1,
            maximum: maxIntensity,
          },
          exercises: {
            type: "ARRAY",
            minItems: 1,
            maxItems: 8,
            items: {
              type: "OBJECT",
              additionalProperties: false,
              properties: {
                name: { type: "STRING" },
                reason: { type: "STRING" },
                sets: { type: "INTEGER", minimum: 1, maximum: 5 },
                reps: { type: "STRING" },
                rest_sec: { type: "INTEGER", minimum: 0, maximum: 300 },
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
        required: ["weekly_frequency", "intensity", "exercises"],
      },
    },
    required: [
      "medical_disclaimer",
      "risk_flags",
      "summary",
      "calorie_guide",
      "macro_guide",
      "workout_plan",
    ],
  };
}
