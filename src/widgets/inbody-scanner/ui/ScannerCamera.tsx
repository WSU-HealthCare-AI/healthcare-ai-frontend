import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCameraFormat,
} from 'react-native-vision-camera';
import * as FileSystem from 'expo-file-system/legacy';

const CAPTURE_INTERVAL_MS = 600;

interface Props {
  onFrame: (jpegBuffer: ArrayBuffer) => void;
  isScanning: boolean;
}

export function ScannerCamera({ onFrame, isScanning }: Props) {
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [{ photoResolution: { width: 640, height: 480 } }]);
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef<Camera>(null);
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

    if (capturingRef.current || !cameraRef.current) return;

    capturingRef.current = true;

    try {
      console.log('[Camera] taking photo...');
      const photo = await cameraRef.current.takePhoto({ flash: 'off' });
      console.log('[Camera] photo taken:', photo.path);

      const uri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;

      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      console.log('[Camera] base64 length:', b64.length);

      const binaryString = atob(b64);
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
        <Text className="text-white">카메라를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <Camera
        ref={cameraRef}
        device={device}
        format={format}
        isActive={true}
        photo={true}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
