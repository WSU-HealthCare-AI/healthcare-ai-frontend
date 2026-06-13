import { z } from "zod";

// Zod를 사용하여 런타임 검증과 타입 정의를 단 한 곳에서 일관되게 관리합니다.

export const ExerciseSchema = z.object({
  name: z.string(), // 영어 원래 이름 (DB 매핑 및 비전 연동 매치용 키)
  name_ko: z.string(), // 화면 레이아웃에 노출될 수려한 한글 번역명 (자가치유 단계에서 동적 바인딩됨)
  gif_url: z.string().url(), // 100% 동작을 가이드할 CDN 이미지 원격 스트리밍 주소
  reason: z.string(), // 맞춤 처방의 해부학적 추천 근거
  sets: z.number().min(1).max(5), // 세트 수 제어 범위
  reps: z.string(), // 수행 횟수 가이드라인
  rest_sec: z.number().min(0).max(300), // 적정 세트 간 휴식 타임
  cautions: z.string(), // 신체 상태에 최적화된 주의 사항 텍스트
});

export const RoutineDaySchema = z.object({
  day: z.number().min(1).max(7), // 1일차 ~ 7일차
  is_rest_day: z.boolean(), // 휴식일 활성화 flag
  daily_target: z.string(), // 해당 요일 집중 공략 목표
  exercises: z.array(ExerciseSchema), // 요일별 세부 운동 목록
});

export const DietDaySchema = z.object({
  day: z.number().min(1).max(7),
  breakfast: z.string(),
  lunch: z.string(),
  dinner: z.string(),
  snack: z.string().optional(),
});

export const MacroGuideSchema = z.object({
  carbs_pct: z.number().min(0).max(100),
  protein_pct: z.number().min(0).max(100),
  fat_pct: z.number().min(0).max(100),
});

export const WorkoutPlanSchema = z.object({
  intensity: z.number().min(1).max(5),
  weekly_frequency: z.number().min(1).max(7),
  weekly_routine: z.array(RoutineDaySchema).length(7), // 정확히 일주일치 7개 아이템이 들었는지 런타임 확인
});

export const AIPlanPayloadSchema = z.object({
  medical_disclaimer: z.string(), // 메디컬 가드레일 면책 문구
  risk_flags: z.array(z.string()), // 디스크/무릎 질환별 위험 경고 태그 모음
  summary: z.string(), // 코치의 전반적인 총평
  calorie_guide: z.number().min(1000).max(4000), // 일일 에너지 권장치
  macro_guide: MacroGuideSchema, // 탄단지 3중 비율 셋
  weekly_diet_plan: z.array(DietDaySchema).length(7), // 주간 삼시세끼 맞춤 식단 정보
  workout_plan: WorkoutPlanSchema, // 주간 트레이닝 루틴 핵심
});

// Zod 스키마로부터 TypeScript 타입을 자동으로 추출하여 일관성을 보호합니다.
export type Exercise = z.infer<typeof ExerciseSchema>;
export type RoutineDay = z.infer<typeof RoutineDaySchema>;
export type DietDay = z.infer<typeof DietDaySchema>;
export type MacroGuide = z.infer<typeof MacroGuideSchema>;
export type WorkoutPlan = z.infer<typeof WorkoutPlanSchema>;
export type AIPlanPayload = z.infer<typeof AIPlanPayloadSchema>;
