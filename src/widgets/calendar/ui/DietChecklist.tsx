import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Smile, CheckCircle2 } from 'lucide-react-native';

export interface DietChecklistProps {
  todayDietPlan: any;
  selectedLog: any;
  toggleDiet: (key: string) => void;
  isCheckableDate: boolean;
}

export function DietChecklist({
  todayDietPlan,
  selectedLog,
  toggleDiet,
  isCheckableDate,
}: DietChecklistProps) {
  return (
    <View className="mb-6">
      <View className="mb-3 flex-row items-center">
        <Smile size={20} color="#10B981" />
        <Text className="ml-2 text-base font-bold text-gray-800">맞춤 식단 리스트</Text>
      </View>

      {todayDietPlan ? (
        (['breakfast', 'lunch', 'snack', 'dinner'] as const).map((mealKey) => {
          const mealNames: Record<string, string> = {
            breakfast: '아침 식단',
            lunch: '점심 식단',
            snack: '오후 간식',
            dinner: '저녁 식단',
          };
          const isCompleted = selectedLog?.completed_diets?.includes(mealKey) ?? false;
          return (
            <TouchableOpacity
              key={mealKey}
              onPress={() => toggleDiet(mealKey)}
              disabled={!isCheckableDate}
              className={`mb-2.5 flex-row items-center rounded-xl border border-gray-100 bg-gray-50 p-3.5 ${
                isCheckableDate ? '' : 'opacity-50'
              }`}>
              <CheckCircle2 size={22} color={isCompleted ? '#10B981' : '#D1D5DB'} />
              <View className="ml-3 flex-1">
                <Text className="text-xs font-bold text-emerald-600">{mealNames[mealKey]}</Text>
                <Text
                  className={`mt-0.5 text-sm font-semibold ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                  {todayDietPlan[mealKey]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })
      ) : (
        <Text className="text-sm text-gray-400">설정된 식단 정보가 존재하지 않습니다.</Text>
      )}
    </View>
  );
}
