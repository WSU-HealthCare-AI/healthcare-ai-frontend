import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Play, Clock, Zap, Coffee, AlertTriangle } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { RoutineDay, Exercise } from '@/src/entities/recommendation/model/schema';
import { useCurrentUserProfile } from '@/src/entities/user/api/useCurrentUserProfile';
import { useRecommendationPlan } from '@/src/features/recommendation/api/useRecommendationPlan';

export default function WorkoutScreen() {
  const router = useRouter();
  const { userId } = useCurrentUserProfile();

  // currentDay를 가져와서 UI에 반영합니다.
  const { plan, currentDay, status } = useRecommendationPlan(userId);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="border-b border-gray-50 px-6 py-4">
        <Text className="text-2xl font-bold text-gray-900">주간 운동 플랜</Text>
        <Text className="mt-1 text-gray-500">AI 코치가 설계한 일주일 일정을 확인하세요.</Text>
      </View>

      {!plan && (status === 'syncing' || status === 'generating') ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="mt-4 font-medium text-gray-500">
            최적의 운동 플랜을 준비 중입니다...
          </Text>
        </View>
      ) : !plan || !plan.workout_plan?.weekly_routine ? (
        <View className="flex-1 items-center justify-center px-6">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <AlertTriangle size={32} color="#9CA3AF" />
          </View>
          <Text className="mb-2 text-lg font-bold text-gray-900">아직 생성된 플랜이 없습니다</Text>
          <Text className="mb-8 text-center leading-6 text-gray-500">
            대시보드에서 건강 데이터를 입력하고{'\n'}나만의 AI 맞춤 플랜을 생성해 보세요.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(main)')}
            className="w-full items-center rounded-2xl bg-blue-600 py-4">
            <Text className="text-base font-bold text-white">대시보드로 이동하기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/(main)/camera')}
            className="mt-4 w-full rounded-3xl bg-blue-600 p-6 shadow-lg shadow-blue-100">
            <View className="mb-10 flex-row items-center justify-between">
              <View className="rounded-full bg-white/20 px-3 py-1">
                <Text className="text-xs font-bold text-white">AI 감지 모드</Text>
              </View>
              <Camera size={24} color="white" />
            </View>

            <Text className="mb-2 text-3xl font-bold text-white">운동 시작하기</Text>

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Clock size={16} color="white" opacity={0.7} />
                <Text className="opacity-0.9 ml-1 mr-4 text-sm text-white">
                  주 {plan.workout_plan.weekly_frequency}회 목표
                </Text>
              </View>
              <View className="flex-row items-center">
                <Zap size={16} color="white" opacity={0.7} />
                <Text className="opacity-0.9 ml-1 text-sm text-white">
                  Level {plan.workout_plan.intensity}
                </Text>
              </View>
              <View className="ml-auto rounded-full bg-white p-4">
                <Play size={24} color="#2563EB" fill="#2563EB" />
              </View>
            </View>
          </TouchableOpacity>

          <Text className="mb-4 mt-8 text-xl font-bold text-gray-900">일주일 치 상세 루틴</Text>

          {plan.workout_plan.weekly_routine.map((dayPlan: RoutineDay, index: number) => (
            <View
              key={index}
              // 오늘 날짜인 경우 하이라이트
              className={`mb-4 rounded-2xl border p-4 ${dayPlan.day === currentDay ? 'border-blue-400 bg-blue-50 shadow-sm shadow-blue-100' : 'border-gray-100 bg-gray-50'}`}>
              <View className="mb-3 flex-row items-center justify-between border-b border-gray-200 pb-3">
                <View className="flex-row items-center">
                  <Text
                    className={`mr-2 font-bold ${dayPlan.day === currentDay ? 'text-lg text-blue-700' : 'text-blue-600'}`}>
                    {dayPlan.day}일차
                  </Text>

                  {/* 오늘 배지 */}
                  {dayPlan.day === currentDay && (
                    <View className="mr-2 rounded bg-blue-600 px-2 py-0.5">
                      <Text className="text-xs font-bold text-white">오늘</Text>
                    </View>
                  )}

                  <Text className="font-bold text-gray-900">{dayPlan.daily_target}</Text>
                </View>
                {dayPlan.is_rest_day ? (
                  <View className="flex-row items-center rounded-full bg-gray-200 px-3 py-1">
                    <Coffee size={14} color="#6B7280" className="mr-1" />
                    <Text className="text-xs font-bold text-gray-600">휴식</Text>
                  </View>
                ) : (
                  <Text className="text-xs text-gray-500">
                    {dayPlan.exercises?.length || 0}개 동작
                  </Text>
                )}
              </View>

              {dayPlan.is_rest_day ? (
                <Text className="py-2 text-sm text-gray-500">
                  근육의 회복을 위해 충분한 휴식을 취해주세요.
                </Text>
              ) : (
                dayPlan.exercises?.map((ex: Exercise, exIdx: number) => (
                  <View key={exIdx} className="mb-2 flex-row items-start">
                    <View className="mr-2 mt-1 h-1.5 w-1.5 rounded-full bg-blue-400" />
                    <View className="flex-1">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm font-bold text-gray-800">{ex.name}</Text>
                        <Text className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                          {ex.sets}세트 × {ex.reps}
                        </Text>
                      </View>
                      <Text className="mt-1 text-xs leading-4 text-gray-500">{ex.cautions}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          ))}

          <View className="h-10" />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
