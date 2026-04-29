import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Bell, Trophy, AlertTriangle, RefreshCw, Info, Activity } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { useCurrentUserProfile } from '@/src/entities/user/api/useCurrentUserProfile';
import { useRecommendationPlan } from '@/src/features/recommendation/api/useRecommendationPlan';
import { DietGuideWidget } from '@/src/widgets/recommendation/ui/DietGuideWidget';
import { WorkoutPlanWidget } from '@/src/widgets/recommendation/ui/WorkoutPlanWidget';
import { RoutineListWidget } from '@/src/widgets/recommendation/ui/RoutineListWidget';

export default function DashboardScreen() {
  const router = useRouter();

  // 유저 정보 훅 호출
  const { userId, userName, userLoading } = useCurrentUserProfile();

  // AI 훅 호출
  const { plan, status, error, retry } = useRecommendationPlan(userId);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <StatusBar style="dark" />

      {/* 상단 헤더 */}
      <View className="flex-row items-center justify-between px-6 py-4">
        <View className="flex-row items-center">
          <View>
            <Text className="text-sm font-medium text-gray-400">오늘도 힘차게 시작해볼까요?</Text>
            <View className="flex-row items-center">
              <Text className="text-2xl font-bold text-gray-900">{userName}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          className="rounded-full bg-gray-50 p-2 active:opacity-60"
          accessibilityRole="button"
          accessibilityLabel="알림 확인하기"
          accessibilityHint="새로운 알림이 있는지 확인합니다.">
          <Bell size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
        {/* ==================== 1. 플랜 데이터가 아예 없을 때 ==================== */}

        {!plan && (status === 'idle' || status === 'syncing' || userLoading) && (
          <View
            className="mt-6 items-center justify-center rounded-3xl border border-gray-100 bg-gray-50 py-12"
            accessible={true}
            accessibilityLabel="데이터를 동기화 중입니다">
            <ActivityIndicator size="large" color="#9CA3AF" className="mb-4" />
            <Text className="text-base font-bold text-gray-500">데이터를 확인하고 있습니다...</Text>
          </View>
        )}

        {!plan && status === 'generating' && (
          <View
            className="mt-6 items-center justify-center rounded-3xl border border-blue-100 bg-blue-50 py-12"
            accessible={true}
            accessibilityLabel="AI가 맞춤 플랜을 생성 중입니다. 최대 10초가 소요됩니다.">
            <ActivityIndicator size="large" color="#2563EB" className="mb-4" />
            <Text className="text-base font-bold text-blue-900">
              AI가 맞춤 플랜을 생성 중입니다
            </Text>
            <Text className="mt-2 px-6 text-center text-sm text-blue-700">
              회원님의 인바디 데이터와 건강 기록을 분석하여{'\n'}최적의 플랜을 짜고 있어요. (최대
              10초 소요)
            </Text>
          </View>
        )}

        {!plan && status === 'error' && (
          <View className="mt-6 items-center justify-center rounded-3xl border border-red-100 bg-red-50 p-6">
            <AlertTriangle size={36} color="#EF4444" className="mb-3" />
            <Text className="mb-1 text-lg font-bold text-red-900">플랜 생성 문제 발생</Text>
            <Text className="mb-5 text-center text-sm leading-5 text-red-700">
              {error || '알 수 없는 문제가 발생했습니다.'}
            </Text>
            <TouchableOpacity
              onPress={retry}
              accessibilityRole="button"
              accessibilityLabel="플랜 다시 생성하기"
              accessibilityHint="네트워크를 통해 데이터를 다시 불러옵니다."
              className="flex-row items-center justify-center rounded-xl bg-red-600 px-6 py-3 shadow-sm"
              activeOpacity={0.8}>
              <RefreshCw size={18} color="white" className="mr-2" />
              <Text className="font-bold text-white">다시 시도하기</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ==================== 2. 플랜 데이터가 있을 때 ==================== */}

        {plan && (
          <View className="pb-12">
            {status === 'error' && (
              <View className="mb-4 flex-row items-center justify-between rounded-2xl border border-red-100 bg-red-50 p-4">
                <View className="flex-1 flex-row items-center pr-2">
                  <AlertTriangle size={18} color="#EF4444" className="mr-2 flex-shrink-0" />
                  <Text className="text-sm font-bold leading-5 text-red-900">
                    최신화 실패. 이전 플랜을 표시합니다.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={retry}
                  className="rounded-lg bg-red-100 px-4 py-2 active:opacity-70"
                  accessibilityRole="button"
                  accessibilityLabel="다시 시도">
                  <Text className="text-xs font-bold text-red-700">재시도</Text>
                </TouchableOpacity>
              </View>
            )}

            {(status === 'syncing' || status === 'generating') && (
              <View className="mb-4 flex-row items-center rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <ActivityIndicator size="small" color="#2563EB" className="mr-3" />
                <Text className="text-sm font-bold text-blue-900">
                  건강 데이터 변경을 감지하여 갱신 중입니다...
                </Text>
              </View>
            )}

            {/* AI 요약 경고문 */}
            {plan.risk_flags && plan.risk_flags.length > 0 && (
              <View className="mt-2 flex-row items-start rounded-2xl border border-red-100 bg-red-50 p-4">
                <AlertTriangle size={18} color="#EF4444" className="mr-2 mt-0.5 flex-shrink-0" />
                <View className="flex-1">
                  <Text className="mb-2 text-sm font-bold text-red-800">AI 맞춤 주의사항</Text>
                  {plan.risk_flags.map((flag, idx) => (
                    <Text
                      key={`flag-${flag.substring(0, 5)}-${idx}`}
                      className="mb-1 text-xs leading-5 text-red-600">
                      • {flag}
                    </Text>
                  ))}
                </View>
              </View>
            )}

            {/* 운동 플랜 위젯 */}
            <WorkoutPlanWidget
              workoutPlan={plan.workout_plan}
              onStartWorkout={() => router.push('/workout')}
            />

            {/* 식단 가이드 위젯 */}
            <DietGuideWidget
              calorieGuide={plan.calorie_guide}
              macroGuide={plan.macro_guide}
              onRefresh={retry}
            />

            {/* 활동 지표 요약 */}
            <View className="mb-4 mt-4 flex-row gap-x-4">
              <View className="flex-1 rounded-3xl border border-gray-100 bg-gray-50 p-5">
                <View className="mb-3 h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <Activity size={20} color="#3B82F6" />
                </View>
                <Text className="mb-1 text-xs font-medium text-gray-400">주간 운동 목표</Text>
                <Text className="text-xl font-bold text-gray-900">
                  {plan.workout_plan.weekly_frequency} <Text className="text-xs">회/주</Text>
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

            {/* 세부 루틴 리스트 위젯 */}
            <RoutineListWidget exercises={plan.workout_plan.exercises} />

            {/* 면책 조항 */}
            <View className="mb-4 mt-6 flex-row items-start rounded-2xl bg-gray-100 p-4">
              <Info size={16} color="#9CA3AF" className="mr-2 mt-0.5 flex-shrink-0" />
              <Text className="flex-1 text-xs leading-5 text-gray-500">
                {plan.medical_disclaimer}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
