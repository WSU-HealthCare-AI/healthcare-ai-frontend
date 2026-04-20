// AI 서버에서 내려주는 유연한 값(문자열로 올 수도 있음)을 처리하기 위한 유니온 타입
export type FlexValue = string | number | null;

// 부위별 근육 분석
export interface SegmentalLean {
  right_arm: FlexValue;
  left_arm: FlexValue;
  trunk: FlexValue;
  right_leg: FlexValue;
  left_leg: FlexValue;
}

// 프론트엔드 앱 전체에서 사용할 인바디 데이터 모델
export interface InbodyRecord {
  // 체성분 분석
  total_body_water_L: FlexValue; // 체수분 (L)
  protein_kg: FlexValue; // 단백질 (kg)
  minerals_kg: FlexValue; // 무기질 (kg)
  body_fat_mass_kg: FlexValue; // 체지방량 (kg)

  // 골격근, 지방분석
  weight_kg: FlexValue; // 체중 (kg)
  skeletal_muscle_mass_kg: FlexValue; // 골격근량 (kg)

  // 비만분석
  bmi: FlexValue; // BMI
  body_fat_percentage: FlexValue; // 체지방률 (%)

  // 부위별 근육 분석
  segmental_lean: SegmentalLean | null;

  // 메타데이터 (DB 저장용)
  id?: string; // DB에 저장된 후 발급되는 UUID
  user_id?: string;
  measured_at?: string; // YYYY-MM-DD 형식
  image_url?: string | null; // 스캔한 원본 이미지
  raw_ocr_text?: string | null; // 디버깅용 원본 텍스트
}
