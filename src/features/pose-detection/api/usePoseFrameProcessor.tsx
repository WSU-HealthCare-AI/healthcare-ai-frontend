import { useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { useFrameProcessor, VisionCameraProxy, Frame, runAsync } from 'react-native-vision-camera';
import { Worklets, useSharedValue as useWorkletSharedValue } from 'react-native-worklets-core';
import { NormalizedLandmark } from '@/src/entities/pose/model/poseTypes';

const plugin = VisionCameraProxy.initFrameProcessorPlugin('detectPose', {}); // 플러그인 초기화

export function detectPose(frame: Frame) {
  'worklet';
  if (plugin == null) throw new Error('Plugin null');
  return plugin.call(frame); // 네이티브 프레임 처리 호출
}

export function usePoseFrameProcessor() {
  const poseLandmarks = useSharedValue<NormalizedLandmark[] | null>(null);

  // 워크렛 내 상태들 (JS와 워크렛 간 동기화용)
  const isJSBusy = useWorkletSharedValue<boolean>(false);
  const consecutiveFrames = useWorkletSharedValue<number>(0);
  const lastStableState = useWorkletSharedValue<boolean>(false);
  const lockedFramesCounter = useWorkletSharedValue<number>(0);
  const normalOrientation = useWorkletSharedValue<number>(0); // 정상 어깨 방향(왼-오 차이의 부호) 저장

  const [isStable, setIsStable] = useState<boolean>(false);

  const updateStatusOnJS = Worklets.createRunOnJS((stable: boolean) => {
    setIsStable(stable); // 안정 상태를 JS에 알림
  });

  const updateLandmarksOnJS = Worklets.createRunOnJS((landmarks: NormalizedLandmark[] | null) => {
    poseLandmarks.value = landmarks; // JS에서 랜드마크 사용 가능하게 설정
    isJSBusy.value = false;
  });

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';

    // 프레임 처리 동시성 제한: JS가 바쁘면 일정 프레임 무시
    if (isJSBusy.value) {
      lockedFramesCounter.value += 1;
      if (lockedFramesCounter.value > 5) {
        isJSBusy.value = false;
        lockedFramesCounter.value = 0;
      } else {
        return;
      }
    }

    lockedFramesCounter.value = 0;
    isJSBusy.value = true;

    // 네이티브 호출을 비동기 워크렛으로 수행
    runAsync(frame, () => {
      'worklet';
      try {
        const result = detectPose(frame) as any;

        if (result && result.landmarks && result.landmarks.length > 0) {
          const lms = result.landmarks;

          // 상체(어깨)가 보이는지 체크 — 보이지 않으면 결과 무시
          const isUpperBodyVisible =
            (lms[11]?.visibility ?? 0) > 0.2 || (lms[12]?.visibility ?? 0) > 0.2;

          if (!isUpperBodyVisible) {
            consecutiveFrames.value = 0;
            if (lastStableState.value !== false) {
              lastStableState.value = false;
              updateStatusOnJS(false);
            }
            updateLandmarksOnJS(null);
            return;
          }

          // 원시 배열로 매핑(전달 비용 최소화)
          const plainLandmarks: NormalizedLandmark[] = new Array(lms.length);
          for (let i = 0; i < lms.length; i++) {
            const lm = lms[i];
            plainLandmarks[i] = {
              x: lm.x,
              y: lm.y,
              z: lm.z || 0,
              visibility: lm.visibility || 0,
              presence: lm.presence || 0,
            };
          }

          // 뼈대 좌우 뒤집힘 보정 로직
          const leftX = plainLandmarks[11].x;
          const rightX = plainLandmarks[12].x;
          const currentDiff = leftX - rightX;

          if (Math.abs(currentDiff) > 0.04) {
            normalOrientation.value = Math.sign(currentDiff); // 충분히 넓으면 정상 방향 업데이트
          }

          const isFlipped =
            normalOrientation.value !== 0 &&
            Math.sign(currentDiff) !== normalOrientation.value &&
            Math.sign(currentDiff) !== 0;

          if (isFlipped) {
            // 좌우 쌍을 스왑하여 원래 위치로 복원
            const pairs = [
              [1, 4],
              [2, 5],
              [3, 6],
              [7, 8],
              [9, 10],
              [11, 12],
              [13, 14],
              [15, 16],
              [17, 18],
              [19, 20],
              [21, 22],
              [23, 24],
              [25, 26],
              [27, 28],
              [29, 30],
              [31, 32],
            ];
            for (let i = 0; i < pairs.length; i++) {
              const lIdx = pairs[i][0];
              const rIdx = pairs[i][1];
              const temp = plainLandmarks[lIdx];
              plainLandmarks[lIdx] = plainLandmarks[rIdx];
              plainLandmarks[rIdx] = temp;
            }
          }

          // 안정성 판단: 연속 프레임이 일정 수 이상이면 안정화로 간주
          consecutiveFrames.value += 1;
          const stable = consecutiveFrames.value > 10;

          if (stable !== lastStableState.value) {
            lastStableState.value = stable;
            updateStatusOnJS(stable);
          }

          updateLandmarksOnJS(plainLandmarks); // JS로 전달
        } else {
          // 랜드마크 없음 처리: 상태 초기화
          consecutiveFrames.value = 0;
          if (lastStableState.value !== false) {
            lastStableState.value = false;
            updateStatusOnJS(false);
          }
          updateLandmarksOnJS(null);
        }
      } catch (e) {
        updateLandmarksOnJS(null); // 예외 시 안전하게 초기화
      }
    });
  }, []);

  return { poseLandmarks, frameProcessor, isStable };
}
