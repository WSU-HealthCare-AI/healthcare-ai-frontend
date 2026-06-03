'use no memo';

import { useState, useMemo, useRef } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { useFrameOutput, Frame } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';
import { NormalizedLandmark } from '@/src/entities/pose/model/poseTypes';
import { poseDetector } from 'react-native-pose-detector';
import { NitroModules } from 'react-native-nitro-modules';

export function usePoseFrameProcessor() {
  const poseLandmarks = useSharedValue<NormalizedLandmark[] | null>(null); // JS에서 읽을 랜드마크 상태
  const [isStable, setIsStable] = useState<boolean>(false); // 랜드마크 안정성 플래그

  const consecutiveFrames = useSharedValue<number>(0); // 연속으로 유효한 프레임 수
  const lastStableState = useSharedValue<boolean>(false); // 마지막 안정 상태 캐시

  const prevLandmarks = useSharedValue<NormalizedLandmark[] | null>(null); // 이전 프레임의 랜드마크
  const lostTrackingCounter = useSharedValue<number>(0); // 트래킹 손실 카운터
  const isLegSwapped = useSharedValue<boolean>(false); // 다리 좌우 스왑 상태 누적 저장

  // 매 프레임 {x, y, z...} 객체 재생성을 억제하기 위한 영구 재사용 객체 배열 (useRef를 사용하여 컴파일러 뮤테이션 에러 방지)
  const cachedLandmarks = useRef<NormalizedLandmark[]>(
    Array.from({ length: 33 }, () => ({
      x: 0,
      y: 0,
      z: 0,
      visibility: 0,
      presence: 0,
    }))
  ).current;

  // 이전 프레임의 캐시용 복제 데이터 구조
  const cachedPrevLandmarks = useRef<NormalizedLandmark[]>(
    Array.from({ length: 33 }, () => ({
      x: 0,
      y: 0,
      z: 0,
      visibility: 0,
      presence: 0,
    }))
  ).current;

  const updateStatus = (stable: boolean) => {
    setIsStable(stable); // 워크렛 -> JS로 안정 상태 전달
  };

  const boxedDetector = useMemo(() => NitroModules.box(poseDetector), []);

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    onFrame: (frame: Frame) => {
      'worklet';

      try {
        let resultBuffer: ArrayBuffer | null = null;
        try {
          resultBuffer = boxedDetector.unbox().detect(frame); // 네이티브에서 ArrayBuffer 바이너리 수신
        } catch (e) {
          console.error('Frame Processor Error:', e);
        }

        if (resultBuffer) {
          // JSI Shared ArrayBuffer를 Float32Array 뷰로 즉시 매핑 (JSON 파싱 비용 0%)
          const lms = new Float32Array(resultBuffer);

          if (lms && lms.length >= 165) {
            // --- 💡 [시간적 일관성 기반 하반신 스왑 필터] ---
            const previous = prevLandmarks.value;

            const kneeLVis = lms[25 * 5 + 3];
            const kneeRVis = lms[26 * 5 + 3];
            const ankleLVis = lms[27 * 5 + 3];
            const ankleRVis = lms[28 * 5 + 3];

            // 1. 두 다리가 모두 명확히 감지되는 상황(모두 가시성 >= 0.35)에서만 스왑 여부를 새로 연산 및 결정
            if (
              previous &&
              kneeLVis >= 0.35 &&
              kneeRVis >= 0.35 &&
              ankleLVis >= 0.35 &&
              ankleRVis >= 0.35
            ) {
              const prevKneeLx = previous[25].x;
              const prevKneeLy = previous[25].y;
              const prevKneeRx = previous[26].x;
              const prevKneeRy = previous[26].y;

              const prevAnkleLx = previous[27].x;
              const prevAnkleLy = previous[27].y;
              const prevAnkleRx = previous[28].x;
              const prevAnkleRy = previous[28].y;

              const currKneeLx = lms[25 * 5];
              const currKneeLy = lms[25 * 5 + 1];
              const currKneeRx = lms[26 * 5];
              const currKneeRy = lms[26 * 5 + 1];

              const currAnkleLx = lms[27 * 5];
              const currAnkleLy = lms[27 * 5 + 1];
              const currAnkleRx = lms[28 * 5];
              const currAnkleRy = lms[28 * 5 + 1];

              // 정상 매칭의 2D 이동 거리 합
              const distNormal =
                Math.hypot(currKneeLx - prevKneeLx, currKneeLy - prevKneeLy) +
                Math.hypot(currKneeRx - prevKneeRx, currKneeRy - prevKneeRy) +
                Math.hypot(currAnkleLx - prevAnkleLx, currAnkleLy - prevAnkleLy) +
                Math.hypot(currAnkleRx - prevAnkleRx, currAnkleRy - prevAnkleRy);

              // 스왑 매칭의 2D 이동 거리 합
              const distSwap =
                Math.hypot(currKneeRx - prevKneeLx, currKneeRy - prevKneeLy) +
                Math.hypot(currKneeLx - prevKneeRx, currKneeLy - prevKneeRy) +
                Math.hypot(currAnkleRx - prevAnkleLx, currAnkleRy - prevAnkleLy) +
                Math.hypot(currAnkleLx - prevAnkleRx, currAnkleLy - prevAnkleRy);

              // 스왑했을 때의 움직임 궤적이 훨씬 자연스럽고(0.08 이상 더 짧을 때) 일치할 경우 스왑 상태로 판정
              if (distSwap < distNormal - 0.08) {
                isLegSwapped.value = true;
              } else if (distNormal < distSwap - 0.08) {
                isLegSwapped.value = false;
              }
              // 그 외 발 가려짐, 이탈 등의 애매한 구간에서는 기존 스왑 잠금 상태(isLegSwapped.value)를 그대로 유지하여 오작동 차단
            }

            // 2. 결정된 스왑 상태에 따라 하반신 관절(골반 [23, 24]은 몸통 뒤틀림 방지를 위해 영구 제외)을 교체
            if (isLegSwapped.value) {
              const LEG_PAIRS = [
                [25, 26],
                [27, 28],
                [29, 30],
                [31, 32],
              ];
              LEG_PAIRS.forEach(([lIdx, rIdx]) => {
                const lStart = lIdx * 5;
                const rStart = rIdx * 5;
                for (let offset = 0; offset < 5; offset++) {
                  const temp = lms[lStart + offset];
                  lms[lStart + offset] = lms[rStart + offset];
                  lms[rStart + offset] = temp;
                }
              });
            }
            // ------------------------------------------------------------------

            // --- [가시성 비례 동적 스무딩(EMA) 필터] ---
            for (let i = 0; i < 33; i++) {
              const idx = i * 5;
              const currX = lms[idx];
              const currY = lms[idx + 1];
              const currZ = lms[idx + 2];
              const visibility = lms[idx + 3];
              const presence = lms[idx + 4];

              if (previous && previous[i]) {
                // 가시성이 높으면 최신 추론을 빠르게 반영하고(0.85), 가시성이 낮으면 이전의 정상값을 지키도록 가중치 동적 축소
                // 가시성이 0.15 미만으로 떨어져 화면에서 이탈한 경우 100% 이전 프레임 좌표를 완전히 고정(Freeze)하여 튐 차단
                let smoothWeight = 0.85;
                if (visibility < 0.5) {
                  if (visibility < 0.15) {
                    smoothWeight = 0; // 가시성 극소 시 100% 이전 데이터 유지 (프리징)
                  } else {
                    smoothWeight = 0.85 * ((visibility - 0.15) / 0.35); // 0.15 ~ 0.5 구간 선형 보간 적용
                  }
                }

                cachedLandmarks[i].x = currX * smoothWeight + previous[i].x * (1 - smoothWeight);
                cachedLandmarks[i].y = currY * smoothWeight + previous[i].y * (1 - smoothWeight);
                cachedLandmarks[i].z = currZ * smoothWeight + previous[i].z * (1 - smoothWeight);

                // 가시성 수치 자체도 EMA를 적용하여 프레임 깜빡임(Flickering)과 선 찢어짐을 차단
                cachedLandmarks[i].visibility =
                  visibility * smoothWeight + previous[i].visibility * (1 - smoothWeight);
                cachedLandmarks[i].presence =
                  presence * smoothWeight + previous[i].presence * (1 - smoothWeight);
              } else {
                cachedLandmarks[i].x = currX;
                cachedLandmarks[i].y = currY;
                cachedLandmarks[i].z = currZ;
                cachedLandmarks[i].visibility = visibility;
                cachedLandmarks[i].presence = presence;
              }
            }

            // cachedPrevLandmarks에 현재 값을 빠르게 복제하여 GC 생성 최소화
            for (let i = 0; i < 33; i++) {
              cachedPrevLandmarks[i].x = cachedLandmarks[i].x;
              cachedPrevLandmarks[i].y = cachedLandmarks[i].y;
              cachedPrevLandmarks[i].z = cachedLandmarks[i].z;
              cachedPrevLandmarks[i].visibility = cachedLandmarks[i].visibility;
              cachedPrevLandmarks[i].presence = cachedLandmarks[i].presence;
            }

            prevLandmarks.value = cachedPrevLandmarks; // 현재 프레임을 이전으로 저장
            lostTrackingCounter.value = 0; // 트래킹 복구

            consecutiveFrames.value += 1;
            const stable = consecutiveFrames.value > 3; // 안정 판정 임계값

            if (stable !== lastStableState.value) {
              lastStableState.value = stable;
              scheduleOnRN(updateStatus, stable); // JS로 안정 상태 전파
            }

            // Reanimated 감지를 위해 1차원 배열의 얕은 복사본(Shallow copy)만 할당
            poseLandmarks.value = [...cachedLandmarks];
          }
        } else {
          // 결과가 없으면 트래킹 손실 처리
          lostTrackingCounter.value += 1;

          if (lostTrackingCounter.value > 5) {
            prevLandmarks.value = null;
            isLegSwapped.value = false; // 스왑 상태 초기화
            consecutiveFrames.value = 0;
            if (lastStableState.value !== false) {
              lastStableState.value = false;
              scheduleOnRN(updateStatus, false);
            }
            poseLandmarks.value = null; // JSI 직접 초기화
          }
        }
      } catch (e) {
        console.error('Frame Processor Logic Error:', e);
        // 예외 발생 시 트래킹 손실 처리(안전 초기화)
        lostTrackingCounter.value += 1;

        if (lostTrackingCounter.value > 5) {
          prevLandmarks.value = null;
          isLegSwapped.value = false; // 스왑 상태 초기화
          consecutiveFrames.value = 0;
          if (lastStableState.value !== false) {
            lastStableState.value = false;
            scheduleOnRN(updateStatus, false);
          }
          poseLandmarks.value = null; // JSI 직접 초기화
        }
      } finally {
        frame.dispose();
      }
    },
  });

  return { poseLandmarks, frameOutput, isStable }; // 훅 반환: 랜드마크, 프레임아웃풋, 안정성
}
