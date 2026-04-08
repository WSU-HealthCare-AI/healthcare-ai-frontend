import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  useCameraPermission,
  useCameraDevice,
  Camera,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useRunOnJS } from 'react-native-worklets-core';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, RotateCcw, Pause, Square } from 'lucide-react-native';
import { Canvas, Circle, Line, vec } from '@shopify/react-native-skia';

import moveNetModel from '@/assets/model.tflite';

type Keypoint = {
  x: number;
  y: number;
  score: number;
  lost?: number;
};

type TensorDataType = 'float32' | 'float16' | 'int32' | 'uint8';
type PixelFormat = 'rgb' | 'argb';

type InferenceAttempt = {
  label: string;
  resizeType: 'float32' | 'uint8';
  tensorType: 'float32' | 'uint8' | 'int32';
  pixelFormat: PixelFormat;
};

const MIN_PROCESS_INTERVAL_NS = 33_000_000;
const FRONT_PORTRAIT_EXTRA_ROTATION_RAD = -Math.PI / 2;
let lastProcessedTimestamp = 0;
let lockedInferenceAttempt: InferenceAttempt | null = null;

const parseModelInputSize = (shape: number[] | undefined, fallback = 256) => {
  'worklet';

  if (!shape || shape.length === 0) return fallback;

  // shape가 [1,1,1,3] 또는 [1,3,256,256]처럼 들어오는 경우를 안전하게 처리
  const spatialCandidates = shape
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v >= 96 && v <= 1024);

  if (spatialCandidates.length === 0) return fallback;

  if (spatialCandidates.includes(256)) return 256;
  if (spatialCandidates.includes(192)) return 192;

  return Math.round(Math.min(...spatialCandidates));
};

const parseModelChannels = (shape: number[] | undefined, fallback = 3) => {
  'worklet';

  if (!shape || shape.length === 0) return fallback;

  const channels = shape
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && (v === 3 || v === 4));

  if (channels.includes(4)) return 4;
  if (channels.includes(3)) return 3;
  return fallback;
};

const flattenTensorData = (value: any): number[] => {
  'worklet';

  const result: number[] = [];
  const stack: any[] = [value];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null) continue;

    if (Array.isArray(current)) {
      for (let i = current.length - 1; i >= 0; i--) {
        stack.push(current[i]);
      }
      continue;
    }

    if (typeof current === 'number') {
      result.push(Number(current));
      continue;
    }

    if (typeof current.length === 'number') {
      for (let i = 0; i < current.length; i++) {
        result.push(Number(current[i]));
      }
    }
  }

  return result;
};

const toInt32Tensor = (input: any) => {
  'worklet';
  const int32Array = new Int32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    int32Array[i] = Number(input[i]);
  }
  return int32Array;
};

const scoreDecodedPose = (points: Keypoint[]) => {
  'worklet';

  let avgScore = 0;
  for (let i = 0; i < points.length; i++) {
    avgScore += points[i].score;
  }
  avgScore /= Math.max(1, points.length);

  const shoulderWidth = points[5] && points[6] ? Math.abs(points[5].x - points[6].x) : 0;
  const hipWidth = points[11] && points[12] ? Math.abs(points[11].x - points[12].x) : 0;

  return avgScore * 10 + shoulderWidth + hipWidth;
};

const applyVisibilityGates = (points: Keypoint[]) => {
  const gated = points.map((pt) => ({ ...pt }));

  const faceAnchor = Math.max(
    gated[0]?.score ?? 0,
    gated[1]?.score ?? 0,
    gated[2]?.score ?? 0,
    gated[3]?.score ?? 0,
    gated[4]?.score ?? 0
  );
  const shoulderAnchor = Math.max(gated[5]?.score ?? 0, gated[6]?.score ?? 0);
  const hipAnchor = Math.max(gated[11]?.score ?? 0, gated[12]?.score ?? 0);

  if (shoulderAnchor < 0.25) {
    for (let i = 5; i <= 10; i++) {
      gated[i].score = 0;
    }
  }

  if (hipAnchor < 0.25) {
    for (let i = 11; i <= 16; i++) {
      gated[i].score = 0;
    }
  }

  if (faceAnchor >= 0.25 && shoulderAnchor < 0.25) {
    // 얼굴만 보이는 프레임에서는 얼굴 외 포인트를 완전히 차단해 난조를 막음.
    for (let i = 5; i <= 16; i++) {
      gated[i].score = 0;
    }
  }

  if (faceAnchor < 0.16 && shoulderAnchor < 0.25) {
    for (let i = 0; i <= 4; i++) {
      gated[i].score = 0;
    }
  }

  return gated;
};

const LEFT_RIGHT_PAIRS = [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8],
  [9, 10],
  [11, 12],
  [13, 14],
  [15, 16],
] as const;

const STRUCTURAL_EDGES = [
  [5, 6],
  [5, 11],
  [6, 12],
  [11, 12],
  [5, 7],
  [7, 9],
  [6, 8],
  [8, 10],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
] as const;

const clamp01 = (value: number) => {
  'worklet';
  return Math.max(0, Math.min(1, value));
};

const clamp = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, value));
};

const getBodyScalePx = (points: Keypoint[]) => {
  const leftShoulder = points[5];
  const rightShoulder = points[6];
  const leftHip = points[11];
  const rightHip = points[12];

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
    return 100;
  }

  const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
  const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipMidX = (leftHip.x + rightHip.x) / 2;
  const hipMidY = (leftHip.y + rightHip.y) / 2;

  const torso = Math.hypot(hipMidX - shoulderMidX, hipMidY - shoulderMidY);
  const shoulders = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);

  return Math.max(70, torso * 1.2 + shoulders * 0.8);
};

const stabilizePairs = (nextPoints: Keypoint[], prevPoints: Keypoint[], bodyScale: number) => {
  const stabilized = [...nextPoints];
  const minGap = Math.max(8, bodyScale * 0.08);

  const pairsToGuard = [
    [5, 6],
    [11, 12],
    [13, 14],
    [15, 16],
  ] as const;

  for (const [leftIndex, rightIndex] of pairsToGuard) {
    const left = stabilized[leftIndex];
    const right = stabilized[rightIndex];
    const prevLeft = prevPoints[leftIndex];
    const prevRight = prevPoints[rightIndex];

    if (!left || !right || !prevLeft || !prevRight) continue;

    const currentGap = Math.abs(left.x - right.x);
    const previousGap = Math.abs(prevLeft.x - prevRight.x);

    if (currentGap < minGap && previousGap > minGap * 0.9) {
      if (left.score < right.score) {
        stabilized[leftIndex] = {
          x: prevLeft.x,
          y: prevLeft.y,
          score: Math.max(left.score, prevLeft.score * 0.9),
          lost: (prevLeft.lost ?? 0) + 1,
        };
      } else {
        stabilized[rightIndex] = {
          x: prevRight.x,
          y: prevRight.y,
          score: Math.max(right.score, prevRight.score * 0.9),
          lost: (prevRight.lost ?? 0) + 1,
        };
      }
    }
  }

  return stabilized;
};

const stabilizeLimbLengths = (nextPoints: Keypoint[], prevPoints: Keypoint[]) => {
  const stabilized = [...nextPoints];

  for (const [start, end] of STRUCTURAL_EDGES) {
    const currStart = stabilized[start];
    const currEnd = stabilized[end];
    const prevStart = prevPoints[start];
    const prevEnd = prevPoints[end];

    if (!currStart || !currEnd || !prevStart || !prevEnd) continue;

    const prevLen = Math.hypot(prevStart.x - prevEnd.x, prevStart.y - prevEnd.y);
    const currLen = Math.hypot(currStart.x - currEnd.x, currStart.y - currEnd.y);

    if (prevLen < 8) continue;

    const lenRatio = currLen / prevLen;
    const invalidLength = lenRatio < 0.35 || lenRatio > 2.6;

    if (!invalidLength) continue;

    if (currStart.score <= currEnd.score && currStart.score < 0.55) {
      stabilized[start] = {
        x: prevStart.x,
        y: prevStart.y,
        score: Math.max(currStart.score, prevStart.score * 0.88),
        lost: (prevStart.lost ?? 0) + 1,
      };
    } else if (currEnd.score < 0.55) {
      stabilized[end] = {
        x: prevEnd.x,
        y: prevEnd.y,
        score: Math.max(currEnd.score, prevEnd.score * 0.88),
        lost: (prevEnd.lost ?? 0) + 1,
      };
    }
  }

  return stabilized;
};

const swapLeftRightIfNeeded = (points: Keypoint[], cameraPosition: 'front' | 'back') => {
  if (cameraPosition !== 'front') return points;

  const leftShoulder = points[5];
  const rightShoulder = points[6];
  const leftHip = points[11];
  const rightHip = points[12];

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return points;

  const shoulderInverted = leftShoulder.x > rightShoulder.x + 0.015;
  const hipInverted = leftHip.x > rightHip.x + 0.015;

  if (!shoulderInverted && !hipInverted) return points;

  const swapped = [...points];
  for (const [leftIndex, rightIndex] of LEFT_RIGHT_PAIRS) {
    const left = swapped[leftIndex];
    const right = swapped[rightIndex];
    swapped[leftIndex] = right;
    swapped[rightIndex] = left;
  }
  return swapped;
};

const scorePoseCandidate = (candidate: Keypoint[], mapped: Keypoint[], prev: Keypoint[]) => {
  const leftShoulder = candidate[5];
  const rightShoulder = candidate[6];
  const leftHip = candidate[11];
  const rightHip = candidate[12];
  const leftKnee = candidate[13];
  const rightKnee = candidate[14];
  const leftAnkle = candidate[15];
  const rightAnkle = candidate[16];

  let score = 0;

  if (leftShoulder && rightShoulder && leftHip && rightHip) {
    const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const hipY = (leftHip.y + rightHip.y) / 2;
    const torsoHeight = hipY - shoulderY;
    const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);

    if (torsoHeight > 0.07 && torsoHeight < 0.75) score += 4;
    if (shoulderWidth > 0.04) score += 2;
    if (hipY > shoulderY) score += 2;

    const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
    const hipMidX = (leftHip.x + rightHip.x) / 2;
    const verticalDelta = Math.abs(hipY - shoulderY);
    const horizontalDelta = Math.abs(hipMidX - shoulderMidX);

    // 세로 촬영에서 몸통 축이 세로에 가까운 후보를 강하게 선호
    score += verticalDelta > horizontalDelta + 0.03 ? 4 : -3;
  }

  if (leftHip && leftKnee && leftAnkle) {
    if (leftKnee.y >= leftHip.y - 0.02) score += 1;
    if (leftAnkle.y >= leftKnee.y - 0.02) score += 1;
  }

  if (rightHip && rightKnee && rightAnkle) {
    if (rightKnee.y >= rightHip.y - 0.02) score += 1;
    if (rightAnkle.y >= rightKnee.y - 0.02) score += 1;
  }

  for (let i = 0; i < candidate.length; i++) {
    score += candidate[i].score * 0.3;
  }

  if (prev.length === 17) {
    let totalDistance = 0;
    let count = 0;
    for (let i = 0; i < 17; i++) {
      const prevPoint = prev[i];
      const currPoint = mapped[i];
      if (!prevPoint || !currPoint) continue;
      if (prevPoint.score < 0.1 || currPoint.score < 0.1) continue;

      totalDistance += Math.hypot(currPoint.x - prevPoint.x, currPoint.y - prevPoint.y);
      count += 1;
    }
    if (count > 0) {
      score -= Math.min(200, totalDistance / count) * 0.04;
    }
  }

  return score;
};

// 우측: Cyan, 좌측: Magenta, 몸통: Yellow
const EDGES = [
  { start: 0, end: 1, color: '#FF00FF' },
  { start: 0, end: 2, color: '#00FFFF' },
  { start: 1, end: 3, color: '#FF00FF' },
  { start: 2, end: 4, color: '#00FFFF' },
  { start: 0, end: 5, color: '#FF00FF' },
  { start: 0, end: 6, color: '#00FFFF' },
  { start: 5, end: 7, color: '#FF00FF' },
  { start: 7, end: 9, color: '#FF00FF' },
  { start: 6, end: 8, color: '#00FFFF' },
  { start: 8, end: 10, color: '#00FFFF' },
  { start: 5, end: 6, color: '#FFFF00' },
  { start: 5, end: 11, color: '#FF00FF' },
  { start: 6, end: 12, color: '#00FFFF' },
  { start: 11, end: 12, color: '#FFFF00' },
  { start: 11, end: 13, color: '#FF00FF' },
  { start: 13, end: 15, color: '#FF00FF' },
  { start: 12, end: 14, color: '#00FFFF' },
  { start: 14, end: 16, color: '#00FFFF' },
];

export default function CameraScreen() {
  const router = useRouter();

  const { hasPermission, requestPermission } = useCameraPermission();
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('front');
  const device = useCameraDevice(cameraPosition);

  // 상단바, 하단바를 제외한 실제 렌더링 구역의 정확한 사이즈
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [keypoints, setKeypoints] = useState<Keypoint[]>([]);
  const [debugInfo, setDebugInfo] = useState('모델 로딩 중');

  const aiModel = useTensorflowModel(moveNetModel);
  const { resize } = useResizePlugin();

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    if (aiModel.state === 'loading') {
      setDebugInfo('모델 로딩 중');
      return;
    }

    if (aiModel.state === 'loaded') {
      setDebugInfo('모델 준비 완료');
      return;
    }

    setDebugInfo('모델 로딩 실패');
  }, [aiModel.state]);

  // 센서/기기마다 다른 회전 차이를 자동으로 흡수하고 스켈레톤을 안정화
  const updateDebugJS = useRunOnJS((message: string) => {
    setDebugInfo((prev) => (prev === message ? prev : message));
  }, []);

  const updateSkeletonJS = useRunOnJS(
    (
      newKeypoints: Keypoint[],
      fWidth: number,
      fHeight: number,
      lWidth: number,
      lHeight: number,
      currentCameraPosition: 'front' | 'back'
    ) => {
      if (lWidth === 0 || lHeight === 0) return;

      const isLandscapeSensor = fWidth > fHeight;

      // 카메라 센서 방향에 따른 시각적 비율
      const visImageWidth = isLandscapeSensor ? fHeight : fWidth;
      const visImageHeight = isLandscapeSensor ? fWidth : fHeight;

      // 화면(layout)을 cover 모드로 꽉 채웠을 때의 확대 스케일
      const scale = Math.max(lWidth / visImageWidth, lHeight / visImageHeight);

      // 확대된 프레임이 화면에서 차지하는 실제 크기 (삐져나가는 부분 포함)
      const drawWidth = visImageWidth * scale;
      const drawHeight = visImageHeight * scale;

      // 화면 밖으로 삐져나간 영역 (마이너스 오프셋)
      const offsetX = (lWidth - drawWidth) / 2;
      const offsetY = (lHeight - drawHeight) / 2;

      const variants =
        isLandscapeSensor && lHeight > lWidth && currentCameraPosition === 'front'
          ? [
              // 전면 미러링이 뒤에서 한 번 더 적용되므로, 최종 결과가 좌측 90도가 되게 보정
              (pt: Keypoint) => ({ x: 1 - pt.y, y: 1 - pt.x, score: pt.score }),
            ]
          : isLandscapeSensor && lHeight > lWidth
            ? [
                (pt: Keypoint) => ({ x: pt.y, y: 1 - pt.x, score: pt.score }),
                (pt: Keypoint) => ({ x: 1 - pt.y, y: pt.x, score: pt.score }),
              ]
            : isLandscapeSensor
              ? [
                  (pt: Keypoint) => ({ x: pt.x, y: pt.y, score: pt.score }),
                  (pt: Keypoint) => ({ x: pt.y, y: 1 - pt.x, score: pt.score }),
                  (pt: Keypoint) => ({ x: 1 - pt.y, y: pt.x, score: pt.score }),
                ]
              : [(pt: Keypoint) => ({ x: pt.x, y: pt.y, score: pt.score })];

      setKeypoints((prev) => {
        let selectedCandidate: Keypoint[] = [];
        let selectedMapped: Keypoint[] = [];
        let bestScore = -Infinity;

        for (let variantIndex = 0; variantIndex < variants.length; variantIndex++) {
          const transform = variants[variantIndex];
          const transformed = newKeypoints.map((pt) => {
            const transformedPoint = transform(pt);
            const mirroredX =
              currentCameraPosition === 'front' ? 1 - transformedPoint.x : transformedPoint.x;
            return {
              x: clamp01(mirroredX),
              y: clamp01(transformedPoint.y),
              score: clamp01(pt.score),
            };
          });

          const gated = applyVisibilityGates(transformed);
          const stableSides = swapLeftRightIfNeeded(gated, currentCameraPosition);
          let mapped = stableSides.map((pt) => ({
            x: offsetX + pt.x * drawWidth,
            y: offsetY + pt.y * drawHeight,
            score: pt.score,
            lost: 0,
          }));

          if (isLandscapeSensor && lHeight > lWidth && currentCameraPosition === 'front') {
            const cx = lWidth / 2;
            const cy = lHeight / 2;
            const cos = Math.cos(FRONT_PORTRAIT_EXTRA_ROTATION_RAD);
            const sin = Math.sin(FRONT_PORTRAIT_EXTRA_ROTATION_RAD);

            mapped = mapped.map((pt) => {
              const dx = pt.x - cx;
              const dy = pt.y - cy;
              return {
                x: cx + dx * cos - dy * sin,
                y: cy + dx * sin + dy * cos,
                score: pt.score,
                lost: pt.lost,
              };
            });
          }

          let poseScore = scorePoseCandidate(stableSides, mapped, prev);

          if (poseScore > bestScore) {
            bestScore = poseScore;
            selectedCandidate = stableSides;
            selectedMapped = mapped;
          }
        }

        if (selectedMapped.length === 0) return prev;
        if (prev.length === 0) return selectedMapped;

        const DETECT_THRESHOLD = 0.1;
        const HOLD_FRAMES = 0;
        const bodyScale = getBodyScalePx(prev);
        const outlierJump = Math.max(26, bodyScale * 1.05);

        // EMA + 짧은 홀드 프레임으로 순간 유실 깜빡임을 완화
        const smoothed = selectedMapped.map((pt, i) => {
          const prevPt = prev[i];
          const candidatePt = selectedCandidate[i];
          if (!prevPt || !candidatePt) return pt;

          if (candidatePt.score < DETECT_THRESHOLD) {
            const lostCount = (prevPt.lost ?? 0) + 1;
            if (lostCount <= HOLD_FRAMES) {
              return {
                x: prevPt.x,
                y: prevPt.y,
                score: Math.max(candidatePt.score, prevPt.score * 0.92),
                lost: lostCount,
              };
            }
            return { ...pt, lost: lostCount };
          }

          const dist = Math.hypot(pt.x - prevPt.x, pt.y - prevPt.y);
          const isOutlier = dist > outlierJump && candidatePt.score < 0.2;
          if (isOutlier) {
            return {
              x: prevPt.x,
              y: prevPt.y,
              score: Math.max(candidatePt.score, prevPt.score * 0.9),
              lost: (prevPt.lost ?? 0) + 1,
            };
          }

          const normalizedDist = dist / Math.max(1, bodyScale);
          const alpha = clamp(0.9 + normalizedDist * 0.15, 0.9, 0.99);

          return {
            x: prevPt.x + alpha * (pt.x - prevPt.x),
            y: prevPt.y + alpha * (pt.y - prevPt.y),
            score: prevPt.score * 0.05 + candidatePt.score * 0.95,
            lost: 0,
          };
        });

        const pairStabilized = stabilizePairs(smoothed, prev, bodyScale);
        return stabilizeLimbLengths(pairStabilized, prev);
      });
    },
    []
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';

      const timestamp = Number(frame.timestamp ?? 0);
      if (timestamp > 0 && lastProcessedTimestamp > 0) {
        const delta = timestamp - lastProcessedTimestamp;
        if (delta > 0 && delta < MIN_PROCESS_INTERVAL_NS) {
          return;
        }
      }
      if (timestamp > 0) {
        lastProcessedTimestamp = timestamp;
      }

      if (aiModel.state === 'loaded' && aiModel.model != null && layout.width > 0) {
        try {
          const modelInputInfo = aiModel.model.inputs[0];
          const modelInputType = (modelInputInfo?.dataType ?? 'uint8') as TensorDataType;
          const isThunderFloat16 = modelInputType === 'float16';
          const modelInputSize = isThunderFloat16
            ? 256
            : parseModelInputSize(modelInputInfo?.shape, 256);
          const modelChannels = parseModelChannels(modelInputInfo?.shape, 3);
          const preferredPixelFormat: PixelFormat = isThunderFloat16
            ? 'rgb'
            : modelChannels === 4
              ? 'argb'
              : 'rgb';

          // 1:1 입력에서 기본 center-crop이 적용되면 세로 촬영 시 상/하체가 잘릴 수 있어
          // 전체 프레임을 명시적으로 crop 대상으로 지정해 비율만 압축
          const resizeOptions = {
            scale: { width: modelInputSize, height: modelInputSize },
            crop: {
              x: 0,
              y: 0,
              width: frame.width,
              height: frame.height,
            },
          };

          const inferenceAttempts: InferenceAttempt[] = [];

          const pushAttempt = (
            label: string,
            resizeType: 'float32' | 'uint8',
            tensorType: 'float32' | 'uint8' | 'int32',
            pixelFormat: PixelFormat
          ) => {
            if (
              !inferenceAttempts.some(
                (attempt) =>
                  attempt.resizeType === resizeType &&
                  attempt.tensorType === tensorType &&
                  attempt.pixelFormat === pixelFormat
              )
            ) {
              inferenceAttempts.push({ label, resizeType, tensorType, pixelFormat });
            }
          };

          // Thunder 모델은 포맷을 최소화해 지연을 줄임
          if (isThunderFloat16) {
            pushAttempt('thunder-f32-rgb', 'float32', 'float32', 'rgb');
            pushAttempt('thunder-u8-rgb', 'uint8', 'uint8', 'rgb');
          } else if (modelInputType === 'float32') {
            pushAttempt('meta-float32', 'float32', 'float32', preferredPixelFormat);
            pushAttempt('fallback-uint8', 'uint8', 'uint8', preferredPixelFormat);
            pushAttempt('fallback-int32', 'uint8', 'int32', preferredPixelFormat);
          } else if (modelInputType === 'int32') {
            pushAttempt('meta-int32', 'uint8', 'int32', preferredPixelFormat);
            pushAttempt('fallback-uint8', 'uint8', 'uint8', preferredPixelFormat);
            pushAttempt('fallback-float32', 'float32', 'float32', preferredPixelFormat);
          } else {
            pushAttempt('meta-uint8', 'uint8', 'uint8', preferredPixelFormat);
            pushAttempt('fallback-int32', 'uint8', 'int32', preferredPixelFormat);
            pushAttempt('fallback-float32', 'float32', 'float32', preferredPixelFormat);
          }

          if (!isThunderFloat16) {
            // 채널 수/색공간 이슈 대비 argb/rgb 교차 폴백
            const alternatePixelFormat: PixelFormat =
              preferredPixelFormat === 'rgb' ? 'argb' : 'rgb';
            pushAttempt('alt-float32', 'float32', 'float32', alternatePixelFormat);
            pushAttempt('alt-uint8', 'uint8', 'uint8', alternatePixelFormat);
          }

          let outputs: any = null;

          if (lockedInferenceAttempt) {
            try {
              const resized = resize(frame, {
                ...resizeOptions,
                pixelFormat: lockedInferenceAttempt.pixelFormat,
                dataType: lockedInferenceAttempt.resizeType,
              });
              const inputTensor =
                lockedInferenceAttempt.tensorType === 'int32' ? toInt32Tensor(resized) : resized;
              outputs = aiModel.model.runSync([inputTensor]);
            } catch {
              lockedInferenceAttempt = null;
            }
          }

          if (!outputs) {
            for (let i = 0; i < inferenceAttempts.length; i++) {
              const attempt = inferenceAttempts[i];

              try {
                const resized = resize(frame, {
                  ...resizeOptions,
                  pixelFormat: attempt.pixelFormat,
                  dataType: attempt.resizeType,
                });

                const inputTensor =
                  attempt.tensorType === 'int32' ? toInt32Tensor(resized) : resized;
                outputs = aiModel.model.runSync([inputTensor]);
                lockedInferenceAttempt = attempt;
                break;
              } catch {
                // 다음 포맷으로 재시도
              }
            }
          }

          if (!outputs) {
            updateDebugJS('추론 실패: 모든 입력 포맷 시도 실패');
            return;
          }
          let rawKeypoints: number[] = [];

          if (Array.isArray(outputs)) {
            for (let i = 0; i < outputs.length; i++) {
              const flattened = flattenTensorData(outputs[i]);
              if (flattened.length >= 51) {
                rawKeypoints = flattened;
                break;
              }
            }
          } else {
            rawKeypoints = flattenTensorData(outputs);
          }

          if (rawKeypoints.length >= 51) {
            const parsedKeypoints: Keypoint[] = [];
            const fallbackKeypoints: Keypoint[] = [];
            let coordMax = 0;
            let scoreMax = 0;

            for (let i = 0; i < 17; i++) {
              const rawY = Number(rawKeypoints[i * 3]);
              const rawX = Number(rawKeypoints[i * 3 + 1]);
              const rawScore = Number(rawKeypoints[i * 3 + 2]);
              coordMax = Math.max(coordMax, Math.abs(rawY), Math.abs(rawX));
              scoreMax = Math.max(scoreMax, Math.abs(rawScore));
            }

            const coordDivisor = coordMax > 1.5 ? Math.max(coordMax, 2) : 1;
            const scoreDivisor = scoreMax > 1.5 ? Math.max(scoreMax, 2) : 1;

            for (let i = 0; i < 17; i++) {
              const v0 = Number(rawKeypoints[i * 3]);
              const v1 = Number(rawKeypoints[i * 3 + 1]);
              const s = Number(rawKeypoints[i * 3 + 2]);

              const normY = clamp01(v0 / coordDivisor);
              const normX = clamp01(v1 / coordDivisor);
              const normScore = clamp01(s / scoreDivisor);

              parsedKeypoints.push({ x: normX, y: normY, score: normScore });
              fallbackKeypoints.push({ x: normY, y: normX, score: normScore });
            }

            const keypointsToUse = isThunderFloat16
              ? parsedKeypoints
              : scoreDecodedPose(parsedKeypoints) >= scoreDecodedPose(fallbackKeypoints) + 0.15
                ? parsedKeypoints
                : fallbackKeypoints;

            updateSkeletonJS(
              keypointsToUse,
              frame.width,
              frame.height,
              layout.width,
              layout.height,
              cameraPosition
            );
          } else {
            updateDebugJS('모델 출력 파싱 실패');
          }
        } catch (e) {
          updateDebugJS(`추론 실패: ${String(e)}`);
        }
      }
    },
    [aiModel, resize, cameraPosition, updateSkeletonJS, updateDebugJS, layout.width, layout.height]
  );

  const toggleCamera = () => setCameraPosition((prev) => (prev === 'back' ? 'front' : 'back'));

  if (!hasPermission || device == null) {
    return <View className="flex-1 bg-black" />;
  }

  const CONFIDENCE_THRESHOLD = 0.12;

  return (
    <View className="flex-1 bg-black">
      {/* onLayout을 통해 기기별 상/하단바가 제외된 순수 렌더링 영역 크기 측정 */}
      <View style={StyleSheet.absoluteFill} onLayout={(e) => setLayout(e.nativeEvent.layout)}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          resizeMode="cover"
          frameProcessor={frameProcessor}
        />

        <View style={StyleSheet.absoluteFill} className="pointer-events-none z-40">
          {layout.width > 0 && (
            <Canvas style={{ flex: 1 }}>
              {EDGES.map((edge, i) => {
                const p1 = keypoints[edge.start];
                const p2 = keypoints[edge.end];

                if (
                  p1 &&
                  p2 &&
                  p1.score > CONFIDENCE_THRESHOLD &&
                  p2.score > CONFIDENCE_THRESHOLD
                ) {
                  return (
                    <Line
                      key={`line-${i}`}
                      p1={vec(p1.x, p1.y)}
                      p2={vec(p2.x, p2.y)}
                      color={edge.color}
                      strokeWidth={4}
                    />
                  );
                }
                return null;
              })}

              {keypoints.map((pt, i) => {
                if (pt && pt.score > CONFIDENCE_THRESHOLD) {
                  return <Circle key={`pt-${i}`} cx={pt.x} cy={pt.y} r={6} color="#FF1493" />;
                }
                return null;
              })}
            </Canvas>
          )}

          <View className="absolute left-3 top-3 rounded bg-black/50 px-2 py-1">
            <Text className="text-xs text-white">{debugInfo}</Text>
          </View>
        </View>
      </View>

      <SafeAreaView
        edges={['top']}
        className="absolute top-0 z-50 w-full flex-row items-center justify-between px-6 pt-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-12 w-12 items-center justify-center rounded-full bg-black/40">
          <ArrowLeft color="white" size={24} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={toggleCamera}
          className="h-12 w-12 items-center justify-center rounded-full bg-black/40">
          <RotateCcw color="white" size={24} />
        </TouchableOpacity>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} className="absolute bottom-0 z-50 w-full px-6 pb-8">
        <View className="flex-row items-end justify-between">
          <View>
            <Text className="mb-2 text-6xl font-extrabold text-white">
              00 <Text className="text-3xl font-medium text-gray-300">/ 15</Text>
            </Text>
            <View className="mt-1 flex-row gap-6">
              <View>
                <Text className="text-sm font-medium text-gray-400">운동 시간</Text>
                <Text className="mt-1 text-xl font-bold text-white">00:00</Text>
              </View>
              <View>
                <Text className="text-sm font-medium text-gray-400">소모 칼로리</Text>
                <Text className="mt-1 text-xl font-bold text-white">0 kcal</Text>
              </View>
            </View>
          </View>

          <View className="flex-row gap-4">
            <TouchableOpacity className="h-16 w-16 items-center justify-center rounded-full bg-white/20">
              <Pause color="white" size={28} fill="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.back()}
              className="h-16 w-16 items-center justify-center rounded-full bg-red-500 shadow-lg shadow-red-500/50">
              <Square color="white" size={24} fill="white" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
