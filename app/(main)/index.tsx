import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Bell, Trophy, AlertTriangle, Activity } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { useCurrentUserProfile } from '@/src/entities/user/api/useCurrentUserProfile';
import { useRecommendationPlan } from '@/src/features/recommendation/api/useRecommendationPlan';
import { DietGuideWidget } from '@/src/widgets/recommendation/ui/DietGuideWidget';
import { WorkoutPlanWidget } from '@/src/widgets/recommendation/ui/WorkoutPlanWidget';
import { AISummaryWidget } from '@/src/widgets/recommendation/ui/AISummaryWidget';

export default function DashboardScreen() {
  const router = useRouter();
  const { userId, userName, userLoading } = useCurrentUserProfile();

  const { plan, currentDay, status, error, retry } = useRecommendationPlan(userId);

  useEffect(() => {
    // 데이터가 없고 대기(idle) 상태일 때 자동으로 AI 생성 시작
    if (!userLoading && userId && status === 'idle' && !plan) {
      console.log('데이터 없음: AI 맞춤 플랜 생성 시작');
      retry();
    }
  }, [userLoading, userId, status, plan, retry]);

  // UI 렌더링 분기
  const isInitialLoading = !plan && (status === 'idle' || status === 'syncing' || userLoading);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <StatusBar style="dark" />

      {/* 헤더 */}
      <View className="flex-row items-center justify-between px-6 py-4">
        <View>
          <Text className="text-sm font-medium text-gray-400">오늘도 힘차게 시작해볼까요?</Text>
          <Text className="text-2xl font-bold text-gray-900">{userName || '회원'}</Text>
        </View>
        <TouchableOpacity className="rounded-full bg-gray-50 p-2">
          <Bell size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
        {isInitialLoading && (
          <View className="mt-12 items-center justify-center">
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text className="mt-4 font-medium text-gray-500">
              건강 데이터를 분석하고 있습니다...
            </Text>
          </View>
        )}

        {!plan && status === 'generating' && (
          <View className="mt-6 items-center justify-center rounded-3xl border border-blue-100 bg-blue-50 py-12">
            <ActivityIndicator size="large" color="#2563EB" className="mb-4" />
            <Text className="font-bold text-blue-900">AI 코치가 맞춤 플랜을 생성 중입니다</Text>
            <Text className="mt-2 text-sm text-blue-600">약 20~30초 정도 소요됩니다</Text>
          </View>
        )}

        {!plan && status === 'error' && (
          <View className="mt-6 items-center justify-center rounded-3xl bg-red-50 p-6">
            <AlertTriangle size={36} color="#EF4444" className="mb-3" />
            <Text className="mb-4 text-center text-sm text-red-700">{error}</Text>
            <TouchableOpacity onPress={retry} className="rounded-xl bg-red-600 px-6 py-3">
              <Text className="font-bold text-white">다시 시도</Text>
            </TouchableOpacity>
          </View>
        )}

        {plan && (
          <View className="pb-12">
            {plan.summary && <AISummaryWidget summary={plan.summary} />}

            {/* 위젯들에 공통으로 계산된 currentDay Props 주입 */}
            <WorkoutPlanWidget
              workoutPlan={plan.workout_plan}
              currentDay={currentDay}
              onStartWorkout={() => router.push('/workout')}
            />

            <DietGuideWidget
              calorieGuide={plan.calorie_guide}
              macroGuide={plan.macro_guide}
              weeklyDietPlan={plan.weekly_diet_plan}
              currentDay={currentDay}
            />

            <View className="mt-4 flex-row gap-x-4">
              <View className="flex-1 rounded-3xl border border-gray-100 bg-gray-50 p-5">
                <View className="mb-3 h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <Activity size={20} color="#3B82F6" />
                </View>
                <Text className="mb-1 text-xs font-medium text-gray-400">주간 운동 목표</Text>
                <Text className="text-xl font-bold text-gray-900">
                  {plan.workout_plan.weekly_frequency}회/주
                </Text>
              </View>
              <View className="flex-1 rounded-3xl border border-gray-100 bg-gray-50 p-5">
                <View className="mb-3 h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                  <Trophy size={20} color="#F59E0B" />
                </View>
                <Text className="mb-1 text-xs font-medium text-gray-400">권장 운동 강도</Text>
                <Text className="text-xl font-bold text-gray-900">
                  Level {plan.workout_plan.intensity}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
