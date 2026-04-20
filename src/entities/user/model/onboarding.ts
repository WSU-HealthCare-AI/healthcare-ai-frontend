import { z } from 'zod';

// ONBOARDING_DATA 상수
export const ONBOARDING_DATA = {
  GENDERS: ['남성', '여성'],
  PURPOSES: ['다이어트', '근력 향상', '체형 교정', '재활 운동', '체력 증진'],
  EXERCISE_FREQUENCIES: ['아예 안 함', '주 1~2회', '주 3~4회', '주 5회 이상'],
  PAIN_POINTS: ['없음', '목/어깨', '허리', '무릎', '손목/발목'],
  DISEASES: ['없음', '고혈압', '당뇨', '디스크', '천식', '관절염'],
} as const;

// 전체 온보딩 데이터 스키마
export const onboardingSchema = z.object({
  // 기본 정보
  name: z
    .string()
    .min(2, '이름을 2자 이상 입력해주세요.')
    .max(8, '이름은 최대 8자까지 입력 가능합니다.')
    .regex(/^[가-힣A-Za-z0-9]+$/, '특수문자는 사용할 수 없습니다.'),
  birthDate: z.string().regex(/^\d{8}$/, '생년월일 8자리(예: 19900101)를 입력해주세요.'),
  gender: z.string().min(1, '성별을 선택해주세요.'),
  height: z.string().min(1, '키를 입력해주세요.'),
  weight: z.string().min(1, '몸무게를 입력해주세요.'),
  purposes: z.array(z.string()).min(1, '최소 하나 이상의 목적을 선택해주세요.'),
  exerciseFrequency: z.string().min(1, '운동 주기를 선택해주세요.'),
  painPoints: z.array(z.string()).min(1, '통증 부위를 선택해주세요.'),
  diseases: z.array(z.string()).min(1, '질환 여부를 선택해주세요.'),
  allergies: z.string().optional(),
  surgeryHistory: z.string().optional(),
});

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;
