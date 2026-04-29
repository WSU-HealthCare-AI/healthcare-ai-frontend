import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Utensils, RefreshCw } from 'lucide-react-native';

interface DietGuideWidgetProps {
  calorieGuide: number;
  macroGuide: {
    carbs_pct: number;
    protein_pct: number;
    fat_pct: number;
  };
  onRefresh: () => void;
}

export function DietGuideWidget({ calorieGuide, macroGuide, onRefresh }: DietGuideWidgetProps) {
  return (
    <View className="mt-4 rounded-3xl bg-gray-900 p-6">
      <View className="mb-5 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Utensils size={18} color="#93C5FD" />
          <Text className="ml-2 px-1 text-base font-bold text-blue-300">맞춤 식단 가이드</Text>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          accessibilityRole="button"
          accessibilityLabel="식단 새로고침"
          accessibilityHint="식단 데이터를 다시 불러옵니다."
          className="p-1 active:opacity-60">
          <RefreshCw size={16} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <View className="space-y-4">
        <MealItem
          label="탄수화물"
          desc={`${Math.round((calorieGuide * (macroGuide.carbs_pct / 100)) / 4)}g 섭취 권장`}
          subDesc={`전체 식단의 ${macroGuide.carbs_pct}% 비율`}
        />
        <MealItem
          label="단백질"
          desc={`${Math.round((calorieGuide * (macroGuide.protein_pct / 100)) / 4)}g 섭취 권장`}
          subDesc={`전체 식단의 ${macroGuide.protein_pct}% 비율`}
        />
        <MealItem
          label="지방"
          desc={`${Math.round((calorieGuide * (macroGuide.fat_pct / 100)) / 9)}g 섭취 권장`}
          subDesc={`전체 식단의 ${macroGuide.fat_pct}% 비율`}
        />
      </View>

      <View className="mt-5 flex-row justify-between border-t border-white/10 pt-5">
        <Text className="text-sm text-gray-400">일일 목표 칼로리</Text>
        <Text className="text-lg font-bold text-white">{calorieGuide} kcal</Text>
      </View>
    </View>
  );
}

// 위젯 내부에서만 사용하는 서브 컴포넌트
const MealItem = ({ label, desc, subDesc }: { label: string; desc: string; subDesc?: string }) => (
  <View className="flex-row items-center justify-between py-1">
    <View className="w-16 items-center rounded-lg bg-blue-900/40 py-1.5">
      <Text className="text-xs font-bold text-blue-300">{label}</Text>
    </View>
    <View className="ml-3 flex-1">
      <Text className="text-base font-bold text-white" numberOfLines={1}>
        {desc}
      </Text>
      {subDesc && <Text className="mt-0.5 text-xs text-gray-400">{subDesc}</Text>}
    </View>
  </View>
);
