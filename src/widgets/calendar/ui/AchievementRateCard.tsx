import React from 'react';
import { View, Text } from 'react-native';

export interface AchievementRateCardProps {
  stats: {
    completedExercises: number;
    completedDiets: number;
    totalExercises: number;
    totalDiets: number;
    rate: number;
    isRestDay: boolean;
  };
  weeklyStats: {
    rate: number;
    completedExercises: number;
    totalExercises: number;
    completedDiets: number;
    totalDiets: number;
  };
}

export function AchievementRateCard({ stats, weeklyStats }: AchievementRateCardProps) {
  return (
    <View className="gap-y-5">
      {/* 1. 일일 달성률 */}
      <View className="flex-row items-center justify-between p-1">
        <View className="flex-1 pr-2">
          <Text className="mb-1 text-xs font-bold uppercase tracking-wider text-blue-800">
            성공적인 하루
          </Text>
          <Text className="mb-0.5 text-lg font-bold text-gray-900">오늘의 달성률</Text>
          <Text className="text-xs text-gray-500">
            완료 운동 수:{' '}
            {stats.isRestDay ? '휴식일' : `${stats.completedExercises} / ${stats.totalExercises}개`}{' '}
            · 완료 식단 수: {stats.completedDiets} / {stats.totalDiets}개
          </Text>
        </View>
        <View className="h-16 w-16 items-center justify-center rounded-full border-4 border-blue-200 bg-white">
          <Text className="text-sm font-bold text-blue-600">{stats.rate}%</Text>
        </View>
      </View>

      <View className="my-1 h-[1px] bg-gray-100" />

      {/* 2. 주간 달성률 */}
      <View className="flex-row items-center justify-between p-1">
        <View className="flex-1 pr-2">
          <Text className="mb-1 text-xs font-bold uppercase tracking-wider text-indigo-800">
            지속 가능한 웰니스
          </Text>
          <Text className="mb-0.5 text-lg font-bold text-gray-900">이번 주 달성률</Text>
          <Text className="text-xs text-gray-500">
            완료 운동 수: {weeklyStats.completedExercises} / {weeklyStats.totalExercises}개 · 완료
            식단 수: {weeklyStats.completedDiets} / {weeklyStats.totalDiets}개
          </Text>
        </View>
        <View className="h-16 w-16 items-center justify-center rounded-full border-4 border-indigo-200 bg-white">
          <Text className="text-sm font-bold text-indigo-600">{weeklyStats.rate}%</Text>
        </View>
      </View>
    </View>
  );
}
