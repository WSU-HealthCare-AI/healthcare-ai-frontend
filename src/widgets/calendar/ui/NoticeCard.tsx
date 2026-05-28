import React from 'react';
import { View, Text } from 'react-native';

export interface NoticeCardProps {
  title: string;
  description: string;
}

export function NoticeCard({ title, description }: NoticeCardProps) {
  return (
    <View className="mb-6 rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <Text className="text-sm font-semibold text-gray-600">{title}</Text>
      <Text className="mt-1 text-xs text-gray-400">{description}</Text>
    </View>
  );
}

export function NoPlanNotice() {
  return (
    <NoticeCard
      title="해당 주차는 플랜이 없었습니다."
      description="다음 플랜이 생성되면 수행 체크와 통계를 확인할 수 있어요."
    />
  );
}
