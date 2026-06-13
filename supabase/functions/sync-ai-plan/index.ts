/* eslint-disable */
// deno-lint-ignore-file no-explicit-any no-import-prefix
// cspell:disable

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// CORS 에러 방지용 헤더 (모바일 및 웹 클라이언트 접속 지원)
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

// 프롬프트 및 데이터 포맷 변경 시 이전 캐시를 무효화하기 위한 버전 정보
const PLAN_VERSION = "v2.0.1";
const MODEL_NAME = "gemini-3.1-flash-lite";

// 비즈니스 정책 관련 매직 넘버 분리
const AI_POLICY = {
  CALORIE_MIN: 1000,
  CALORIE_MAX: 4000,
  MACRO_TOLERANCE_MIN: 0,
  MACRO_TOLERANCE_MAX: 100,
  SETS_MIN: 1,
  SETS_MAX: 5,
  REST_SEC_MIN: 0,
  REST_SEC_MAX: 300,
};

// 한국 표준시(KST, UTC+9) 기준의 ISO 타임스탬프를 생성하는 헬퍼 함수
function getKSTTimestamp(): string {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  return kstDate.toISOString().replace("Z", "+09:00");
}

// 지수 백오프(Exponential Backoff)를 적용한 API 요청 헬퍼 함수
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 5,
  delay = 1000,
): Promise<Response> {
  try {
    const res = await fetch(url, options);
    if (res.ok) return res;
    if (retries > 1 && (res.status === 429 || res.status >= 500)) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    return res;
  } catch (error) {
    if (retries > 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 예외 상황 시 DB 트래킹을 위한 임시 변수 정의
  let supabaseClient: any = null;
  let currentUserId: string | null = null;
  let inputHashKey = "onboarding-hashed-key";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") ?? "";

    console.log("Supabase URL loaded:", !!supabaseUrl);
    console.log("Supabase Anon Key length:", supabaseAnonKey?.length);

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase 환경설정(URL/Key)이 누락되었습니다.");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Authorization header is missing");
      return new Response(
        JSON.stringify({ error: "인증 헤더가 유효하지 않습니다." }),
        { status: 401, headers: jsonHeaders },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    supabaseClient = supabase;

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth Error details:", authError);
      console.error("User object status:", !!user);
      return new Response(
        JSON.stringify({
          error: "유효하지 않은 토큰입니다.",
          details: authError?.message || "User not found",
        }),
        { status: 401, headers: jsonHeaders },
      );
    }

    currentUserId = user.id;

    // health_profiles 테이블에서 핵심 건강 프로필 조회
    const { data: profile, error: profileError } = await supabase
      .from("health_profiles")
      .select("*")
      .eq("user_id", currentUserId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({
          error:
            "기본 건강 정보 프로필(health_profiles)을 찾을 수 없습니다. 온보딩을 완료해 주세요.",
        }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // inbody_records 테이블에서 가장 최근 측정된 인바디 기록 조회
    const { data: inbody, error: _inbodyError } = await supabase
      .from("inbody_records")
      .select("*")
      .eq("user_id", currentUserId)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 멱등성 해시 사전 생성
    if (crypto.subtle) {
      inputHashKey = await getQueryHash(profile, inbody);
    }

    // exercise_metadata select 수행
    const { data: metaList, error: metaError } = await supabase
      .from("exercise_metadata")
      .select("name_en, gif_url, body_part");

    if (metaError || !metaList || metaList.length === 0) {
      return new Response(
        JSON.stringify({
          error: "시스템의 기본 운동 메타데이터 풀(Pool)을 로드할 수 없습니다.",
        }),
        { status: 500, headers: jsonHeaders },
      );
    }

    // 벤치, 철봉, 덤벨, 인버티드 기구 등 집에서 불가능한 장비가 필요한 운동을 배제
    const equipmentKeywords = [
      "bench",
      "bar",
      "pull-up",
      "pullup",
      "chin-up",
      "chinup",
      "inverted",
      "dips",
      "suspension",
      "band",
      "ball",
      "dumbbell",
      "barbell",
      "kettlebell",
      "rope",
      "wheel",
      "roller",
    ];

    // 필터링
    const pureBodyweightExercises = metaList.filter((e: any) => {
      const name = e.name_en.toLowerCase();
      return !equipmentKeywords.some((keyword) => name.includes(keyword));
    });

    const allowedExercisesText = pureBodyweightExercises
      .map((e: any) => `- Name: "${e.name_en}", Target Part: "${e.body_part}"`)
      .join("\n");

    const systemPrompt = `
당신은 기저 질환자를 포함하여 초보자를 안전하게 리드하는 전문 의료 협력 AI 트레이너 및 영양사입니다.
사용자의 신체 정보, 건강 목적, 기저 질환(통증 부위 및 질환명 포함)을 정밀 분석하여 개인화된 일주일치 식단과 홈트레이닝 플랜을 만드세요.

[🚨 개인별 통증 부위 및 기저 질환 안전 가드레일]
사용자의 프로필에 아래 '통증 부위'나 '기저 질환'이 포함되어 있다면 해당 수칙을 철저히 엄수하여 안전을 보장하세요:

1. 통증 부위 (painPoints) 대응:
- '허리': 척추 굴곡/비틀림 유발 운동(윗몸일으키기 등) 및 척추 압박을 주는 무리한 상체 거치 동작을 전면 배제하고, 안전한 바닥 지지 코어 운동(버드독, 플랭크, 브릿지) 위주로 편성.
- '무릎': 딥 스쿼트나 과도한 런지 등 무릎 굴곡 각도가 심한 운동을 전면 차단하고, 벽 스쿼트(Wall sit)나 둔근 위주 운동으로 안전하게 대체.
- '목/어깨': 어깨 위로 무거운 걸 밀어올리는 프레스 동작 및 과도한 어깨 하중 운동 제외.
- '손목/발목': 지면에 체중을 직접 싣고 손목/발목으로 버티는 플랭크/푸쉬업 등은 무릎 대고 진행하거나 엘보우 지지 방식으로 변형하여 제안.

2. 기저 질환 (diseases) 대응:
- '디스크' 또는 '관절염': 위 '허리' 및 '무릎' 통증 가이드를 1순위로 엄수하여 관절 스트레스를 최소화하는 저강도 안정화 동작 위주로 구성.
- '고혈압' 또는 '당뇨': 머리가 심장보다 아래로 내려가는 역자세 운동 및 호흡을 급격히 멈추는(발살바) 과부하 운동 금지. 일정한 유산소성 맨몸 운동 권장.
- '천식': 숨이 급격하게 차오르는 초고강도 인터벌 운동을 지양하고 점진적으로 호흡을 조절할 수 있는 안정적인 홈트레이닝으로 구성.
- 모든 위험 가능 운동을 완벽하게 차단하는 일에 실패할 경우 환자의 안전에 치명적입니다.

[🎯 핵심 제약 조건: 영어 운동명 엄수 및 홈트레이닝 지향]
- 일주일치 운동 루틴 설계 시, 아래 지정된 '허용 운동 목록(Allowed Exercise Pool)'의 "Name"에 있는 영문 이름 그대로만 운동을 선택하고 "name" 컬럼에 배정할 수 있습니다.
- 단 한 단어라도 마음대로 지어내거나 철자를 임의로 수정하는 것(Hallucination)을 절대 금지합니다.
- 모든 운동은 집에서 별도의 도구나 기구(벤치, 철봉, 평행봉 등) 없이 맨몸으로 바로 할 수 있는 홈트레이닝 운동이어야 합니다.
- 단, "name_ko" 컬럼에는 사용자와 한국인 헬스 인구들이 직관적으로 단박에 이해할 수 있는 가장 우아하고 자연스러운 형태의 맞춤형 한국어 이름을 실시간으로 지어주세요. 
  (예: "assisted single leg squat" -> "보조 기댄 한 다리 스쿼트" 또는 "의자 딛고 서는 외발 스쿼트")

[허용 운동 목록(Allowed Exercise Pool)]
${allowedExercisesText}

[출력 포맷 규칙]
- JSON 스키마 구조에 맞춰 완벽한 객체를 출력하세요.
- 사용자에게 전달되는 모든 조언과 설명은 친절하고 따뜻한 한국어 존댓말(~해요, ~해 주세요, ~합니다)로 작성하되, 대기 시간 단축을 위해 핵심 정보 위주로 군더더기 없이 정돈하세요:
  1. 각 운동별 'reason'과 'cautions'는 사용자 조건에 맞춤화된 이유와 주의점을 1~2줄 이내의 명확하고 상냥한 문장으로 작성하세요.
  2. 'medical_disclaimer'는 기계적인 "전문가와 상담하라"는 식의 뻔한 멘트를 피하고, 사용자의 질환 및 통증에 맞춰 실질적으로 유용한 홈트레이닝 안전 팁과 정중한 주의사항을 2~3줄 이내로 서술하세요.
  3. 'summary'는 이번 주 운동 및 식단 설계의 핵심 방향성과 응원 문구를 2~3줄 이내로 따뜻하게 서술하세요.
`;

    const purposesStr = Array.isArray(profile.purposes)
      ? profile.purposes.join(", ")
      : JSON.stringify(profile.purposes ?? []);
    const diseasesStr = Array.isArray(profile.diseases)
      ? profile.diseases.join(", ")
      : "없음";
    const painPointsStr = Array.isArray(profile.pain_points)
      ? profile.pain_points.join(", ")
      : "없음";

    const userQuery = `
사용자 ID: ${currentUserId}
이름: ${profile.name ?? "회원"}
신체 기본 프로필: 성별 ${profile.gender}, 키 ${profile.height}cm, 체중 ${profile.weight}kg, BMI ${
      profile.bmi ?? "미측정"
    }
생년월일: ${profile.birth_date ?? "미상"}
운동 목적: ${purposesStr}
주간 운동 빈도: ${profile.exercise_frequency ?? "주 1~2회"}
보유 질환/기저 질환: ${diseasesStr}
통증 부위 및 포인트: ${painPointsStr}
수술 이력: ${profile.surgery_history || "없음"}
알레르기 정보: ${profile.allergies ? JSON.stringify(profile.allergies) : "없음"}

[정밀 인바디 측정 정보]
측정일자: ${inbody?.measured_at ?? "미측정"}
체수분량: ${inbody?.total_body_water_l ?? "데이터 없음"} L
단백질량: ${inbody?.protein_kg ?? "데이터 없음"} kg
무기질량: ${inbody?.minerals_kg ?? "데이터 없음"} kg
체지방량: ${inbody?.body_fat_mass_kg ?? "데이터 없음"} kg
골격근량: ${inbody?.skeletal_muscle_mass_kg ?? "데이터 없음"} kg
체지방률: ${inbody?.body_fat_percentage ?? "데이터 없음"} %
부위별 체성분 분포: ${
      inbody?.segmental_lean
        ? JSON.stringify(inbody.segmental_lean)
        : "데이터 없음"
    }

위의 고유 조건을 바탕으로, 주간 목표와 칼로리 가이드 및 안전 가이드라인이 명시된 최상의 식단 가이드와 추천 운동 일주일 플랜을 생성해 주세요.
`;

    const geminiSchema = getGeminiSchema();

    const requestPayload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: geminiSchema,
        temperature: 0.5, // 친절하고 인간다운 조언 톤앤매너를 위해 문장 다양성을 0.5로 확보
      },
    };

    const startTime = Date.now();

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${geminiApiKey}`;

    const response = await fetchWithRetry(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      if (supabaseClient && currentUserId) {
        await supabaseClient.from("ai_plans").upsert({
          user_id: currentUserId,
          status: "failed",
          input_hash: inputHashKey,
          plan_version: PLAN_VERSION,
          model_name: MODEL_NAME,
          error_code: "GEMINI_API_ERROR",
          error_message: `AI 추천 연동 실패: ${response.status}`,
          error_details: { details: errText },
          updated_at: getKSTTimestamp(),
          failed_at: getKSTTimestamp(),
        });
      }
      return new Response(
        JSON.stringify({
          error: "AI 플랜 분석 서버와의 연동에 실패했습니다.",
          details: errText,
        }),
        { status: 502, headers: jsonHeaders },
      );
    }

    const geminiResult = await response.json();
    const rawText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error(
        "Gemini 응답 객체로부터 올바른 텍스트를 파싱할 수 없습니다.",
      );
    }

    const aiPlanPayload = JSON.parse(rawText);

    const tokenUsageInput = geminiResult.usageMetadata?.promptTokenCount ??
      null;
    const tokenUsageOutput = geminiResult.usageMetadata?.candidatesTokenCount ??
      null;

    // [자가 치유(Self-Healing) 및 다이내믹 머징 단계]
    const exerciseMap = new Map();
    metaList.forEach((item: any) => {
      exerciseMap.set(item.name_en.toLowerCase().trim(), item);
    });

    const weeklyRoutine = aiPlanPayload.workout_plan?.weekly_routine ?? [];

    for (const dayPlan of weeklyRoutine) {
      if (dayPlan.is_rest_day) {
        dayPlan.exercises = [];
        continue;
      }

      const validatedExercises = [];
      const exercises = dayPlan.exercises ?? [];

      for (const ex of exercises) {
        const key = (ex.name ?? "").toLowerCase().trim();
        let matched = exerciseMap.get(key);

        if (!matched) {
          matched = metaList.find(
            (m: any) =>
              m.name_en.toLowerCase().includes(key) ||
              key.includes(m.name_en.toLowerCase()),
          );
        }

        if (!matched) {
          matched = metaList[0] ?? {
            name_en: "Squat",
            gif_url: "https://assets.mixkit.co/fallback-squat.gif",
          };
        }

        // Gemini가 번역해 준 한글 작명(ex.name_ko)을 채택하고,
        // 2선 폴백 상황 시 matched.name_en(영문 원명)을 할당
        const finalKoName = ex.name_ko && ex.name_ko.trim() !== ""
          ? ex.name_ko
          : matched.name_en;

        validatedExercises.push({
          name: matched.name_en,
          name_ko: finalKoName,
          gif_url: matched.gif_url,
          reason: ex.reason || "체력 및 코어 근력 강화를 유도합니다.",
          sets: typeof ex.sets === "number" ? ex.sets : 3,
          reps: ex.reps || "10-12회",
          rest_sec: typeof ex.rest_sec === "number" ? ex.rest_sec : 60,
          cautions: ex.cautions ||
            "바른 호흡법과 정상 기립 궤적을 철저히 유지하세요.",
        });
      }

      dayPlan.exercises = validatedExercises;
    }

    const { data: savedPlan, error: saveError } = await supabase
      .from("ai_plans")
      .upsert({
        user_id: currentUserId,
        status: "completed",
        input_hash: inputHashKey,
        plan_version: PLAN_VERSION,
        model_name: MODEL_NAME,
        plan_payload: aiPlanPayload,
        latency_ms: latencyMs,
        token_usage_input: tokenUsageInput,
        token_usage_output: tokenUsageOutput,
        updated_at: getKSTTimestamp(),
        completed_at: getKSTTimestamp(),
      })
      .select()
      .single();

    if (saveError) {
      throw saveError;
    }

    return new Response(JSON.stringify({ success: true, data: savedPlan }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err: any) {
    if (supabaseClient && currentUserId) {
      try {
        await supabaseClient.from("ai_plans").upsert({
          user_id: currentUserId,
          status: "failed",
          input_hash: inputHashKey,
          plan_version: PLAN_VERSION,
          model_name: MODEL_NAME,
          error_code: "RUNTIME_EXCEPTION",
          error_message: err.message || "서버 내부 처리에 예외가 발생했습니다.",
          updated_at: getKSTTimestamp(),
          failed_at: getKSTTimestamp(),
        });
      } catch (dbErr) {
        console.error("실패 상태 데이터베이스 업서트 에러:", dbErr);
      }
    }

    return new Response(
      JSON.stringify({
        error: err.message || "서버 내부 처리에 예외가 발생했습니다.",
      }),
      { status: 500, headers: jsonHeaders },
    );
  }
});

// 프로필 및 인바디 데이터에 대응하는 멱등성 해시 계산기
async function getQueryHash(profile: any, inbody: any): Promise<string> {
  const source = JSON.stringify({
    gender: profile.gender,
    height: profile.height,
    weight: profile.weight,
    purposes: profile.purposes,
    diseases: profile.diseases,
    pain_points: profile.pain_points,
    exercise_frequency: profile.exercise_frequency,
    inbody_measured_at: inbody?.measured_at || "no-inbody",
    inbody_muscle: inbody?.skeletal_muscle_mass_kg || 0,
    inbody_fat: inbody?.body_fat_percentage || 0,
  });
  const msgUint8 = new TextEncoder().encode(source);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Gemini 구조화 스키마 매퍼 정의
function getGeminiSchema() {
  return {
    type: "OBJECT",
    properties: {
      medical_disclaimer: {
        type: "STRING",
      },
      risk_flags: {
        type: "ARRAY",
        items: { type: "STRING" },
      },
      summary: {
        type: "STRING",
      },
      calorie_guide: {
        type: "INTEGER",
      },
      macro_guide: {
        type: "OBJECT",
        properties: {
          carbs_pct: {
            type: "INTEGER",
          },
          protein_pct: {
            type: "INTEGER",
          },
          fat_pct: {
            type: "INTEGER",
          },
        },
        required: ["carbs_pct", "protein_pct", "fat_pct"],
      },
      weekly_diet_plan: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            day: { type: "INTEGER" },
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
          intensity: { type: "INTEGER" },
          weekly_frequency: { type: "INTEGER" },
          weekly_routine: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                day: { type: "INTEGER" },
                is_rest_day: { type: "BOOLEAN" },
                daily_target: { type: "STRING" },
                exercises: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      name: {
                        type: "STRING",
                      },
                      name_ko: {
                        type: "STRING",
                      },
                      reason: {
                        type: "STRING",
                      },
                      sets: {
                        type: "INTEGER",
                      },
                      reps: {
                        type: "STRING",
                      },
                      rest_sec: {
                        type: "INTEGER",
                      },
                      cautions: {
                        type: "STRING",
                      },
                    },
                    required: [
                      "name",
                      "name_ko",
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
