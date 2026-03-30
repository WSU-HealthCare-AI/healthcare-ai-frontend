import { z } from 'zod';

// ONBOARDING_DATA 상수
export const ONBOARDING_DATA = {
  GENDERS: ['남성', '여성'],
  PURPOSES: ['다이어트', '근력 향상', '체형 교정', '재활 운동', '체력 증진'],
  PAIN_POINTS: ['없음', '목/어깨', '허리', '무릎', '손목/발목', '기타'],
  DISEASES: ['없음', '고혈압', '당뇨', '디스크', '천식', '관절염'],
} as const;

// 전체 온보딩 데이터 스키마
export const onboardingSchema = z.object({
  // 기본 정보
  gender: z.string().min(1, '성별을 선택해주세요.'),
  height: z.string().min(1, '키를 입력해주세요.'),
  weight: z.string().min(1, '몸무게를 입력해주세요.'),
  purposes: z.array(z.string()).min(1, '최소 하나 이상의 목적을 선택해주세요.'),
  painPoints: z.array(z.string()).min(1, '통증 부위를 선택해주세요.'),
  diseases: z.array(z.string()).min(1, '질환 여부를 선택해주세요.'),
  surgeryHistory: z.string().optional(),

  //  인바디 정보
  muscleMass: z.string().optional(),
  fatPercentage: z.string().optional(),
  bmi: z.string().optional(),
});

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;
