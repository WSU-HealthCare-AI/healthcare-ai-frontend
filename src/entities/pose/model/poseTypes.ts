/**
 * MediaPipe Tasks Pose Landmarker에서 반환하는 정규화된 3D 랜드마크 데이터.
 *
 * x, y, z는 화면 비율에 관계없이 0.0 ~ 1.0 사이의 값을 가짐.
 */
export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number; // 0.0 ~ 1.0 (화면 내 존재 확률)
  presence: number; // 0.0 ~ 1.0 (가려지지 않고 실제로 보이는 확률)
}

/**
 * 프레임 당 추출된 포즈 데이터 객체
 */
export interface Pose {
  landmarks: NormalizedLandmark[];
}
