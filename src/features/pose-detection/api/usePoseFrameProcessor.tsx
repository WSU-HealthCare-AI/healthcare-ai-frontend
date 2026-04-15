import { useState, useMemo } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { useFrameProcessor, VisionCameraProxy, Frame } from 'react-native-vision-camera';
import { Worklets, useSharedValue as useWorkletSharedValue } from 'react-native-worklets-core';
import { NormalizedLandmark } from '@/src/entities/pose/model/poseTypes';

const plugin = VisionCameraProxy.initFrameProcessorPlugin('detectPose', {}); // 네이티브 프레임 프로세서 플러그인 초기화

export function usePoseFrameProcessor() {
  const poseLandmarks = useSharedValue<NormalizedLandmark[] | null>(null); // JS에서 읽을 랜드마크 상태
  const [isStable, setIsStable] = useState<boolean>(false); // 랜드마크 안정성 플래그

  const consecutiveFrames = useWorkletSharedValue<number>(0); // 연속으로 유효한 프레임 수
  const lastStableState = useWorkletSharedValue<boolean>(false); // 마지막 안정 상태 캐시
  const frameCounter = useWorkletSharedValue<number>(0); // 프레임 샘플링 카운터

  const prevLandmarks = useWorkletSharedValue<NormalizedLandmark[] | null>(null); // 이전 프레임의 랜드마크
  const lostTrackingCounter = useWorkletSharedValue<number>(0); // 트래킹 손실 카운터

  const smoothedAnomalyScore = useWorkletSharedValue<number>(0); // 이상 징후(튀는 프레임) 지표의 스무딩 값

  const updateLandmarksOnJS = useMemo(() => {
    return Worklets.createRunOnJS((landmarks: NormalizedLandmark[] | null) => {
      poseLandmarks.value = landmarks; // 워크렛 -> JS로 랜드마크 전달
    });
  }, [poseLandmarks]);

  const updateStatusOnJS = useMemo(() => {
    return Worklets.createRunOnJS((stable: boolean) => {
      setIsStable(stable); // 워크렛 -> JS로 안정 상태 전달
    });
  }, []);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';

      if (plugin == null) return; // 플러그인 준비 안 됐으면 무시

      frameCounter.value += 1;
      if (frameCounter.value % 2 !== 0) {
        return; // 성능을 위해 홀수 프레임은 스킵(샘플링)
      }

      try {
        const resultStr = plugin.call(frame, { rotation: 270 }) as string | null; // 네이티브에서 JSON 문자열 수신 (회전 보정 포함)

        if (resultStr) {
          const lms = JSON.parse(resultStr); // 문자열 파싱

          if (lms && Array.isArray(lms) && lms.length >= 33) {
            const plainLandmarks: NormalizedLandmark[] = new Array(33);
            const previous = prevLandmarks.value;

            let currentAnomaly = 0; // 현재 프레임의 이상 징후 점수

            if (previous && previous[11] && previous[12] && previous[23] && previous[24]) {
              // 몸통 스케일 안정성 및 중심 이동 기반 이상 감지
              const currTorsoScale =
                (Math.hypot(lms[11][0] - lms[23][0], lms[11][1] - lms[23][1]) +
                  Math.hypot(lms[12][0] - lms[24][0], lms[12][1] - lms[24][1])) /
                2;
              const prevTorsoScale =
                (Math.hypot(previous[11].x - previous[23].x, previous[11].y - previous[23].y) +
                  Math.hypot(previous[12].x - previous[24].x, previous[12].y - previous[24].y)) /
                2;
              const stableTorsoScale = Math.max((currTorsoScale + prevTorsoScale) / 2, 0.001);

              const currCenterX = (lms[11][0] + lms[12][0] + lms[23][0] + lms[24][0]) / 4;
              const currCenterY = (lms[11][1] + lms[12][1] + lms[23][1] + lms[24][1]) / 4;
              const prevCenterX =
                (previous[11].x + previous[12].x + previous[23].x + previous[24].x) / 4;
              const prevCenterY =
                (previous[11].y + previous[12].y + previous[23].y + previous[24].y) / 4;

              const centerJump = Math.hypot(currCenterX - prevCenterX, currCenterY - prevCenterY);
              const normalizedCenterJump = centerJump / stableTorsoScale; // 중심 이동을 토르소 크기로 정규화

              const currShoulderMidX = (lms[11][0] + lms[12][0]) / 2;
              const currShoulderMidY = (lms[11][1] + lms[12][1]) / 2;
              const currHipMidX = (lms[23][0] + lms[24][0]) / 2;
              const currHipMidY = (lms[23][1] + lms[24][1]) / 2;
              const currAngle = Math.atan2(
                currShoulderMidY - currHipMidY,
                currShoulderMidX - currHipMidX
              );

              const prevShoulderMidX = (previous[11].x + previous[12].x) / 2;
              const prevShoulderMidY = (previous[11].y + previous[12].y) / 2;
              const prevHipMidX = (previous[23].x + previous[24].x) / 2;
              const prevHipMidY = (previous[23].y + previous[24].y) / 2;
              const prevAngle = Math.atan2(
                prevShoulderMidY - prevHipMidY,
                prevShoulderMidX - prevHipMidX
              );

              let angleDiff = Math.abs(currAngle - prevAngle);
              if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff; // 각도 차이 보정

              const jumpScore = Math.max(0, Math.min(1, (normalizedCenterJump - 0.15) / 0.25)); // 중심 점프 기반 점수
              const angleScore = Math.max(0, Math.min(1, (angleDiff - 0.5) / 1.5)); // 각도 변화 기반 점수

              currentAnomaly = Math.max(jumpScore, angleScore); // 이상 점수는 둘 중 큰 값

              // 하체 움직임이 크면 이상 점수를 완화
              let maxLegMotion = 0;
              const LEG_JOINTS = [25, 26, 27, 28];
              for (const leg of LEG_JOINTS) {
                if (previous[leg]) {
                  const dx = Math.abs(lms[leg][0] - previous[leg].x);
                  const dy = Math.abs(lms[leg][1] - previous[leg].y);
                  maxLegMotion = Math.max(maxLegMotion, Math.max(dx, dy));
                }
              }

              const legRelief = Math.max(0, Math.min(0.5, (maxLegMotion - 0.04) / 0.08));
              currentAnomaly *= 1 - legRelief; // 다리 움직임 비례로 이상 점수 경감
            }

            // 이상 점수 스무딩 (급증/감소에 다른 필터 적용)
            if (currentAnomaly > smoothedAnomalyScore.value) {
              smoothedAnomalyScore.value =
                smoothedAnomalyScore.value * 0.75 + currentAnomaly * 0.25;
            } else {
              smoothedAnomalyScore.value =
                smoothedAnomalyScore.value * 0.45 + currentAnomaly * 0.55;
            }

            for (let i = 0; i < 33; i++) {
              const lm = lms[i];
              const currX = lm[0];
              const currY = lm[1];
              const currZ = lm[2];
              const visibility = lm[3];
              const presence = lm[4];

              // 하체 가시성 완화: 측면 서는 동작에서 다리 인식을 허용
              const LEG_JOINTS_ALL = [23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
              const isLegJoint = LEG_JOINTS_ALL.includes(i);
              const minVis = isLegJoint ? 0.1 : 0.2; // 다리는 낮은 가시성도 허용

              if (previous && previous[i] && visibility > minVis) {
                const deltaX = Math.abs(currX - previous[i].x);
                const deltaY = Math.abs(currY - previous[i].y);
                const maxDelta = Math.max(deltaX, deltaY);

                let currentWeight = 0.5; // 현재 관절 보정 가중치 기본값

                const isTorsoCore = i === 23 || i === 24;
                const isShoulder = i === 11 || i === 12;

                if (isTorsoCore) {
                  currentWeight = Math.max(0.08, 0.2 - 0.15 * smoothedAnomalyScore.value); // 토르소는 안정적으로 낮은 가중치
                } else if (isShoulder) {
                  const baseShoulderWeight = maxDelta > 0.05 ? 0.8 : 0.5;
                  currentWeight = Math.max(
                    0.18,
                    baseShoulderWeight - 0.06 * smoothedAnomalyScore.value
                  );

                  // 어깨 각도 클램핑: 팔 급변 시 어깨 영향 줄이기
                  const armIdx = i + 2;
                  if (previous[armIdx] && lms[armIdx]) {
                    const armJump = Math.max(
                      Math.abs(lms[armIdx][0] - previous[armIdx].x),
                      Math.abs(lms[armIdx][1] - previous[armIdx].y)
                    );
                    if (armJump > 0.12) {
                      currentWeight *= 0.65; // 급격한 팔 변화 시 어깨 반응 억제
                    }
                  }
                } else {
                  const ARM_JOINTS = [13, 14, 15, 16, 21, 22];
                  if (ARM_JOINTS.includes(i)) {
                    currentWeight = maxDelta > 0.05 ? 0.8 : 0.5;
                  } else {
                    currentWeight = maxDelta > 0.05 ? 0.7 : 0.4;
                  }
                }

                // 이전 값과 가중합하여 스무딩된 위치 생성
                plainLandmarks[i] = {
                  x: currX * currentWeight + previous[i].x * (1 - currentWeight),
                  y: currY * currentWeight + previous[i].y * (1 - currentWeight),
                  z: currZ * (currentWeight * 0.7) + previous[i].z * (1 - currentWeight * 0.7),
                  visibility: visibility,
                  presence: presence,
                };
              } else if (previous && previous[i] && isLegJoint && consecutiveFrames.value > 5) {
                // 다리 가려짐 예측: 이전 상태를 주로 사용하여 부드럽게 유지
                plainLandmarks[i] = {
                  x: previous[i].x * 0.9 + currX * 0.1,
                  y: previous[i].y * 0.9 + currY * 0.1,
                  z: previous[i].z * 0.9 + currZ * 0.1,
                  visibility: Math.min(0.3, previous[i].visibility * 0.9), // 서서히 사라지게 함
                  presence: Math.min(0.3, previous[i].presence * 0.9),
                };
              } else {
                // 새로 수신된 값 그대로 사용
                plainLandmarks[i] = { x: currX, y: currY, z: currZ, visibility, presence };
              }
            }

            prevLandmarks.value = plainLandmarks; // 현재 프레임을 이전으로 저장
            lostTrackingCounter.value = 0; // 트래킹 복구

            consecutiveFrames.value += 1;
            const stable = consecutiveFrames.value > 3; // 안정 판정 임계값

            if (stable !== lastStableState.value) {
              lastStableState.value = stable;
              updateStatusOnJS(stable); // JS로 안정 상태 전파
            }

            updateLandmarksOnJS(plainLandmarks); // JS로 랜드마크 전송
          }
        } else {
          // 결과가 없으면 트래킹 손실 처리
          lostTrackingCounter.value += 1;

          if (lostTrackingCounter.value > 5) {
            prevLandmarks.value = null;
            smoothedAnomalyScore.value = 0;
            consecutiveFrames.value = 0;
            if (lastStableState.value !== false) {
              lastStableState.value = false;
              updateStatusOnJS(false);
            }
            updateLandmarksOnJS(null);
          }
        }
      } catch (e) {
        // 예외 발생 시 트래킹 손실 처리(안전 초기화)
        lostTrackingCounter.value += 1;

        if (lostTrackingCounter.value > 5) {
          prevLandmarks.value = null;
          smoothedAnomalyScore.value = 0;
          consecutiveFrames.value = 0;
          if (lastStableState.value !== false) {
            lastStableState.value = false;
            updateStatusOnJS(false);
          }
          updateLandmarksOnJS(null);
        }
      }
    },
    [updateLandmarksOnJS, updateStatusOnJS]
  );

  return { poseLandmarks, frameProcessor, isStable }; // 훅 반환: 랜드마크, 프레임프로세서, 안정성
}
