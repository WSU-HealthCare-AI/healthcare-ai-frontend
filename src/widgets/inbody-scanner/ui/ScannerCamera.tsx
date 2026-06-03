import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import * as FileSystem from 'expo-file-system/legacy';

const CAPTURE_INTERVAL_MS = 600;

interface Props {
  onFrame: (jpegBuffer: ArrayBuffer) => void;
  isScanning: boolean;
}

export function ScannerCamera({ onFrame, isScanning }: Props) {
  const device = useCameraDevice('back');

  // TS2339, TS7006 에러 해결: device를 any로 캐스팅하고 매개변수 f에 타입을 명시적으로 지정하여 컴파일러의 간섭을 완전히 차단
  const format = device
    ? ((device as any).formats?.find((f: any) => f.photoWidth === 640 && f.photoHeight === 480) ??
      (device as any).formats?.[0])
    : undefined;

  const { hasPermission, requestPermission } = useCameraPermission();

  const cameraRef = useRef<any>(null);
  const capturingRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    console.log('[Camera] isScanning changed:', isScanning, 'ref:', !!cameraRef.current);
  }, [isScanning]);

  const captureAndSend = useCallback(async () => {
    console.log('[Camera] tick', {
      hasRef: !!cameraRef.current,
      capturing: capturingRef.current,
    });

    if (!cameraRef.current || capturingRef.current) return;
    capturingRef.current = true;

    try {
      console.log('[Camera] taking photo...');
      const photo = await cameraRef.current.takePhoto({
        flash: 'off',
        enableShutterSound: false,
      });

      const uri = photo.path;
      console.log('[Camera] Photo captured:', uri);

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      console.log('[Camera] sending frame bytes:', bytes.byteLength);
      onFrame(bytes.buffer);
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (err) {
      console.error('[Camera] Capture error:', err);
    } finally {
      capturingRef.current = false;
    }
  }, [onFrame]);

  useEffect(() => {
    if (!isScanning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      captureAndSend();
    }, CAPTURE_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isScanning, captureAndSend]);

  if (!hasPermission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white">카메라 권한이 필요합니다.</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white">카메라 기기를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        // @ts-ignore
        photo={true}
        // @ts-ignore
        format={format}
      />
    </View>
  );
}
