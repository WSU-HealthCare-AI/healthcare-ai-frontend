import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Utensils, ChevronRight, X, Info } from 'lucide-react-native';
import { DietDay, MacroGuide } from '@/src/entities/recommendation/model/schema';

interface DietGuideWidgetProps {
  calorieGuide: number;
  macroGuide: MacroGuide;
  weeklyDietPlan?: DietDay[];
  currentDay: number;
}

export function DietGuideWidget({
  calorieGuide,
  macroGuide,
  weeklyDietPlan,
  currentDay,
}: DietGuideWidgetProps) {
  const [isModalVisible, setModalVisible] = useState(false);

  if (!weeklyDietPlan || weeklyDietPlan.length === 0) {
    console.warn(
      '[DietGuideWidget] weeklyDietPlan is empty or undefined. 데이터 계약 위반으로 렌더링을 중단합니다.'
    );
    return null;
  }

  const carbsGrams = Math.round((calorieGuide * (macroGuide.carbs_pct / 100)) / 4);
  const proteinGrams = Math.round((calorieGuide * (macroGuide.protein_pct / 100)) / 4);
  const fatGrams = Math.round((calorieGuide * (macroGuide.fat_pct / 100)) / 9);

  // Fallback이 발생했을 때 조용히 넘어가지 않고 개발자에게 경고 로그를 남김.
  const targetDiet = weeklyDietPlan.find((day) => day.day === currentDay);
  if (!targetDiet) {
    console.warn(
      `[DietGuideWidget] currentDay(${currentDay})에 해당하는 식단이 없어 1일차 식단으로 대체(Fallback)합니다.`
    );
  }
  const todayDiet = targetDiet || weeklyDietPlan[0];

  return (
    <View className="mt-4 rounded-3xl bg-gray-900 p-6">
      <View className="mb-5 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Utensils size={18} color="#93C5FD" />
          <Text className="ml-2 px-1 text-base font-bold text-blue-300">
            오늘의 맞춤 식단 <Text className="font-normal opacity-80">· {currentDay}일차</Text>
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          className="flex-row items-center rounded-full bg-white/10 px-3 py-1.5 active:opacity-60">
          <Text className="mr-1 text-xs font-bold text-white">자세히 보기</Text>
          <ChevronRight size={14} color="white" />
        </TouchableOpacity>
      </View>

      <View className="space-y-4">
        <MealSummaryItem time="아침" food={todayDiet.breakfast} />
        <MealSummaryItem time="점심" food={todayDiet.lunch} />
        <MealSummaryItem time="저녁" food={todayDiet.dinner} />
      </View>

      <View className="mt-5 flex-row justify-between border-t border-white/10 pt-5">
        <Text className="text-sm text-gray-400">일일 목표 칼로리</Text>
        <Text className="text-lg font-bold text-white">{calorieGuide} kcal</Text>
      </View>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between border-b border-gray-100 px-6 py-4">
            <Text className="text-xl font-bold text-gray-900">식단 및 영양 가이드</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} className="p-2">
              <X size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>
            <Text className="mb-4 text-lg font-bold text-gray-900">일일 영양 권장량</Text>
            <View className="mb-8 rounded-3xl border border-gray-100 bg-gray-50 p-5">
              <View className="space-y-4">
                <MacroItem
                  label="탄수화물"
                  percent={macroGuide.carbs_pct}
                  grams={carbsGrams}
                  color="bg-blue-500"
                />
                <MacroItem
                  label="단백질"
                  percent={macroGuide.protein_pct}
                  grams={proteinGrams}
                  color="bg-indigo-500"
                />
                <MacroItem
                  label="지방"
                  percent={macroGuide.fat_pct}
                  grams={fatGrams}
                  color="bg-amber-500"
                />
              </View>
              <View className="mt-4 flex-row items-start rounded-xl bg-blue-50 p-3">
                <Info size={16} color="#3B82F6" className="mr-2 mt-0.5" />
                <Text className="ml-2 flex-1 text-xs leading-5 text-blue-800">
                  위 영양소 비율은 회원님의 목표({calorieGuide}kcal) 달성을 위한 최적의 비율입니다.
                </Text>
              </View>
            </View>

            <Text className="mb-4 text-lg font-bold text-gray-900">일주일 맞춤 식단표</Text>
            {weeklyDietPlan.map((day: DietDay) => (
              <View
                key={day.day}
                className={`mb-4 rounded-2xl border p-4 ${day.day === currentDay ? 'border-blue-400 bg-blue-50 shadow-sm shadow-blue-100' : 'border-gray-100 bg-white'}`}>
                <View className="mb-3 flex-row items-center">
                  <Text
                    className={`mr-2 font-bold ${day.day === currentDay ? 'text-lg text-blue-700' : 'text-blue-600'}`}>
                    {day.day}일차
                  </Text>
                  {day.day === currentDay && (
                    <View className="rounded bg-blue-600 px-2 py-0.5 text-xs">
                      <Text className="text-xs font-bold text-white">오늘</Text>
                    </View>
                  )}
                </View>
                <Text className="mb-1 text-sm leading-5 text-gray-700">
                  🌅 아침: {day.breakfast}
                </Text>
                <Text className="mb-1 text-sm leading-5 text-gray-700">☀️ 점심: {day.lunch}</Text>
                <Text className="mb-1 text-sm leading-5 text-gray-700">🌙 저녁: {day.dinner}</Text>
                {day.snack && (
                  <Text className="text-sm leading-5 text-gray-500">🍪 간식: {day.snack}</Text>
                )}
              </View>
            ))}
            <View className="h-10" />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const MealSummaryItem = ({ time, food }: { time: string; food: string }) => (
  <View className="flex-row items-center justify-between py-1">
    <View className="w-12 items-center rounded-lg bg-blue-900/40 py-1.5">
      <Text className="text-xs font-bold text-blue-300">{time}</Text>
    </View>
    <View className="ml-3 flex-1">
      <Text className="text-base font-medium text-white" numberOfLines={1}>
        {food}
      </Text>
    </View>
  </View>
);

const MacroItem = ({
  label,
  percent,
  grams,
  color,
}: {
  label: string;
  percent: number;
  grams: number;
  color: string;
}) => (
  <View className="flex-row items-center justify-between">
    <View className="flex-row items-center">
      <View className={`h-3 w-3 rounded-full ${color} mr-3`} />
      <Text className="text-base font-bold text-gray-700">{label}</Text>
    </View>
    <View className="items-end">
      <Text className="text-base font-bold text-gray-900">{grams}g</Text>
      <Text className="text-xs text-gray-400">{percent}% 비율</Text>
    </View>
  </View>
);
