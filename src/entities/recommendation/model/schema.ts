import { z } from "zod";

// Zod를 사용하여 런타임 검증과 타입 정의를 단 한 곳에서 관리

export const ExerciseSchema = z.object({
  name: z.string(),
  reason: z.string(),
  sets: z.number().min(1).max(5),
  reps: z.string(),
  rest_sec: z.number().min(0).max(300),
  cautions: z.string(),
});

export const RoutineDaySchema = z.object({
  day: z.number().min(1).max(7),
  is_rest_day: z.boolean(),
  daily_target: z.string(),
  exercises: z.array(ExerciseSchema),
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
  weekly_routine: z.array(RoutineDaySchema).length(7), // 정확히 7일치인지 런타임에서 검증
});

export const AIPlanPayloadSchema = z.object({
  medical_disclaimer: z.string(),
  risk_flags: z.array(z.string()),
  summary: z.string(),
  calorie_guide: z.number().min(1000).max(4000),
  macro_guide: MacroGuideSchema,
  weekly_diet_plan: z.array(DietDaySchema).length(7),
  workout_plan: WorkoutPlanSchema,
});

// Zod 스키마로부터 TypeScript 타입을 자동으로 추출
export type Exercise = z.infer<typeof ExerciseSchema>;
export type RoutineDay = z.infer<typeof RoutineDaySchema>;
export type DietDay = z.infer<typeof DietDaySchema>;
export type MacroGuide = z.infer<typeof MacroGuideSchema>;
export type WorkoutPlan = z.infer<typeof WorkoutPlanSchema>;
export type AIPlanPayload = z.infer<typeof AIPlanPayloadSchema>;
