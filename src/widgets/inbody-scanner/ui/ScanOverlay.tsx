import React from 'react';
import { View, Text } from 'react-native';
import type { ScanStatus } from '@/src/features/inbody-scan/model/useInbodyScanner';

interface Props {
  status: ScanStatus;
  framesSent: number;
  fieldsFound: number;
  totalFields?: number;
}

export function ScanOverlay({ status, framesSent, fieldsFound, totalFields = 13 }: Props) {
  return (
    <View className="absolute inset-0 justify-between p-6">
      <View className="mt-16 items-center">
        <View className="rounded-full bg-black/55 px-4 py-2">
          <Text className="text-sm font-medium text-white">
            인바디 결과지를 프레임 안에 맞춰주세요
          </Text>
        </View>
      </View>

      <View className="mb-8 items-center">
        {status === 'connecting' && (
          <View className="rounded-full bg-black/55 px-4 py-2">
            <Text className="text-sm font-medium text-white">연결 중...</Text>
          </View>
        )}

        {status === 'scanning' && (
          <View className="rounded-full bg-black/55 px-4 py-2">
            <Text className="text-sm font-medium text-white">
              스캔 중 · 프레임 {framesSent}장 · 필드 {fieldsFound}/{totalFields}
            </Text>
          </View>
        )}

        {status === 'complete' && (
          <View className="rounded-full bg-emerald-600/90 px-4 py-2">
            <Text className="text-sm font-semibold text-white">필수 항목 인식 완료</Text>
          </View>
        )}

        {status === 'error' && (
          <View className="rounded-full bg-red-600/90 px-4 py-2">
            <Text className="text-sm font-semibold text-white">스캔 오류</Text>
          </View>
        )}
      </View>
    </View>
  );
}
