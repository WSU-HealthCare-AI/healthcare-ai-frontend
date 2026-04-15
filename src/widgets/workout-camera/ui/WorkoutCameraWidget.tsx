import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCameraFormat,
} from 'react-native-vision-camera';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { usePoseFrameProcessor } from '@/src/features/pose-detection/api/usePoseFrameProcessor';

// 스켈레톤 선 연결 정의
const POSE_CONNECTIONS = [
  [8, 6],
  [6, 5],
  [5, 4],
  [4, 0],
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 7],
  [9, 10],
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [27, 29],
  [29, 31],
  [31, 27],
  [24, 26],
  [26, 28],
  [28, 30],
  [30, 32],
  [32, 28],
];

// 랜드마크 인덱스 목록(원 그리기용)
const POSE_JOINTS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
];

export const WorkoutCameraWidget = () => {
  const { hasPermission, requestPermission } = useCameraPermission(); // 카메라 권한 상태/요청 훅
  const device = useCameraDevice('front'); // 전면 카메라 디바이스 선택
  const [layout, setLayout] = useState({ width: 0, height: 0 }); // 캔버스 레이아웃 크기

  const { poseLandmarks, frameProcessor, isStable } = usePoseFrameProcessor(); // 프레임 처리 훅에서 랜드마크와 안정성 여부 수신

  const format = useCameraFormat(device, [
    { videoResolution: { width: 1280, height: 720 } },
    { fps: 30 },
  ]); // 카메라 포맷(해상도/프레임) 우선순위 요청

  useEffect(() => {
    if (!hasPermission) requestPermission(); // 권한 없으면 요청
  }, [hasPermission, requestPermission]);

  // Skia로 포즈 스켈레톤을 그릴 Path를 생성하는 파생값
  const skeletonPath = useDerivedValue(() => {
    const path = Skia.Path.Make();

    if (!isStable || layout.width === 0) return path; // 안정화 전 또는 레이아웃 미설정 시 빈 경로 반환

    const landmarks = poseLandmarks.value;
    if (!landmarks) return path; // 랜드마크 없으면 빈 경로

    const cameraAspectRatio = 9 / 16; // 카메라 가로/세로 비율 보정 값
    const actualCameraWidth = layout.height * cameraAspectRatio; // 실제 카메라 너비 계산
    const offsetX = (actualCameraWidth - layout.width) / 2; // 좌우 오프셋 보정

    const getCoords = (idx: number) => {
      const lm = landmarks[idx];
      if (!lm || lm.visibility < 0.5) return null; // 가시성 낮으면 무시

      return {
        x: (1 - lm.y) * actualCameraWidth - offsetX, // 화면 좌표계로 변환 (x)
        y: (1 - lm.x) * layout.height, // 화면 좌표계로 변환 (y)
      };
    };

    // 연결선 그리기
    POSE_CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const p1 = getCoords(startIdx);
      const p2 = getCoords(endIdx);
      if (p1 && p2) {
        path.moveTo(p1.x, p1.y);
        path.lineTo(p2.x, p2.y);
      }
    });

    // 조인트 원 그리기
    POSE_JOINTS.forEach((idx) => {
      const pt = getCoords(idx);
      if (pt) {
        path.addCircle(pt.x, pt.y, 4);
      }
    });

    return path;
  }, [layout, poseLandmarks, isStable]);

  if (!hasPermission)
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white">권한 필요</Text>
      </View>
    );
  if (!device)
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white">카메라 없음</Text>
      </View>
    );

  return (
    <View className="absolute inset-0" onLayout={(e) => setLayout(e.nativeEvent.layout)}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
        pixelFormat="rgb"
        resizeMode="cover"
        format={format}
        videoStabilizationMode="off"
      />

      {!isStable && (
        <View className="absolute inset-0 z-20 items-center justify-center bg-black/40">
          <View className="items-center rounded-2xl bg-black/70 px-6 py-4">
            <ActivityIndicator size="large" color="#00FFCC" />
            <Text className="mt-3 text-base font-bold text-[#00FFCC]">자세 인식 중...</Text>
          </View>
        </View>
      )}

      {layout.width > 0 && (
        <Canvas style={[StyleSheet.absoluteFill, { zIndex: 10 }]} pointerEvents="none">
          <Path
            path={skeletonPath}
            color="#00FFCC"
            style="stroke"
            strokeWidth={3}
            strokeJoin="round"
            strokeCap="round"
          />
        </Canvas>
      )}
    </View>
  );
};
