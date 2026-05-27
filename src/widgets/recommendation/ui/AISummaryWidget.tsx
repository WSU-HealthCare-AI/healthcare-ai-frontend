import React from 'react';
import { View, Text } from 'react-native';
import { Sparkles } from 'lucide-react-native';

interface AISummaryWidgetProps {
  summary: string;
}

export function AISummaryWidget({ summary }: AISummaryWidgetProps) {
  return (
    <View className="mt-6 rounded-3xl border border-indigo-100 bg-indigo-50 p-6">
      <View className="mb-3 flex-row items-center">
        <Sparkles size={20} color="#4F46E5" />
        <Text className="ml-2 px-1 text-base font-bold text-indigo-900">
          AI 코치의 맞춤 플랜 분석
        </Text>
      </View>
      <Text className="text-sm leading-6 text-indigo-800">{summary}</Text>
    </View>
  );
}
