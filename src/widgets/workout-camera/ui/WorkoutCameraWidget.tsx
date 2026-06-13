import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, LogBox } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { usePoseFrameProcessor } from '@/src/features/pose-detection/api/usePoseFrameProcessor';

LogBox.ignoreLogs(['[react-native-skia]']);

// 스켈레톤 연결(선) 인덱스 목록
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

// 관절을 원으로 표시할 인덱스 목록
const POSE_JOINTS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
];

interface WorkoutCameraWidgetProps {
  onBack?: () => void;
  workoutName?: string;
}

export const WorkoutCameraWidget = ({ onBack, workoutName }: WorkoutCameraWidgetProps) => {
  const { hasPermission, requestPermission } = useCameraPermission(); // 카메라 권한 상태/요청 훅
  const device = useCameraDevice('front'); // 전면 카메라 디바이스 선택
  const [layout, setLayout] = useState({ width: 0, height: 0 }); // 화면 레이아웃 크기 저장

  // 1. [타입 검증 완료] usePoseFrameProcessor 훅 결과의 정확한 시그니처 매핑
  const { poseLandmarks, frameOutput, isStable } = usePoseFrameProcessor();

  // 2. [의존성 린팅 에러 해결] requestPermission 의존성 배열 누락 문제 해결
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const skeletonPath = useDerivedValue(() => {
    // 캔버스 크기가 측정되기 전이나 랜드마크가 없으면 빈 경로 반환
    if (layout.width === 0) {
      return Skia.PathBuilder.Make().build();
    }

    // 3. [TS 2339 해결] poseLandmarks 속성을 정확하게 디스트럭처링하여 value 안전 조회
    const landmarks = poseLandmarks.value;
    if (!landmarks) {
      return Skia.PathBuilder.Make().build();
    }

    const builder = Skia.PathBuilder.Make();
    const cameraAspectRatio = 9 / 16; // 카메라 비율 보정 값
    const actualCameraWidth = layout.height * cameraAspectRatio; // 실제 카메라 너비 계산
    const offsetX = (actualCameraWidth - layout.width) / 2; // 좌우 오프셋 보정

    const getCoords = (idx: number) => {
      const lm = landmarks[idx];
      if (!lm) return null;

      // 가시성 필터 기준을 합리적으로 완화하여 동적 EMA 스무딩 결과가 부드럽게 렌더링되도록 차단 해제
      const LEG_JOINTS_ALL = [23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
      const isLegJoint = LEG_JOINTS_ALL.includes(idx);
      const minVis = isLegJoint ? 0.15 : 0.2; // 일반 관절은 0.2, 다리 관절은 0.15 기준 적용

      if (lm.visibility < minVis) return null;

      return {
        x: lm.x * actualCameraWidth - offsetX, // 네이티브 단에서 이미 미러링+회전이 완료되었으므로 정방향 lm.x 적용
        y: lm.y * layout.height, // 네이티브 단에서 물리 회전이 완료되었으므로 정방향 lm.y 적용
      };
    };

    // 연결선 그리기: 각 연결 쌍을 Path로 연결
    POSE_CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const p1 = getCoords(startIdx);
      const p2 = getCoords(endIdx);
      if (p1 && p2) {
        builder.moveTo(p1.x, p1.y);
        builder.lineTo(p2.x, p2.y);
      }
    });

    // 조인트(관절) 원 그리기
    POSE_JOINTS.forEach((idx) => {
      const pt = getCoords(idx);
      if (pt) {
        builder.addCircle(pt.x, pt.y, 4);
      }
    });

    return builder.build();
  }, [layout, poseLandmarks]);

  if (!hasPermission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white">권한 필요</Text>
        {/* 권한 안내 UI */}
      </View>
    );
  }

  if (!device) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white">카메라 없음</Text>
        {/* 카메라 미감지 안내 */}
      </View>
    );
  }

  return (
    // 레이아웃 측정을 위해 최상위 컨테이너에 onLayout 설정
    <View className="absolute inset-0" onLayout={(e) => setLayout(e.nativeEvent.layout)}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        outputs={[frameOutput]} // 프레임마다 포즈 추론 실행
        constraints={[{ fps: 30 }, { videoStabilizationMode: 'off' }]} // 30 FPS 및 비디오 안정화 꺼짐 제약 조건 적용
        resizeMode="cover"
      />

      {!isStable && (
        <View className="absolute inset-0 z-20 items-center justify-center bg-black/40">
          <View className="items-center rounded-2xl bg-black/70 px-6 py-4">
            <ActivityIndicator size="large" color="#00FFCC" />
            <Text className="mt-3 text-base font-bold text-[#00FFCC]">자세 인식 중...</Text>
            {/* 안정화 대기 오버레이 */}
          </View>
        </View>
      )}

      {layout.width > 0 && (
        <Canvas style={[StyleSheet.absoluteFill, { zIndex: 10 }]} pointerEvents="none">
          <Path
            path={skeletonPath} // Skia Path로 스켈레톤 렌더링
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
