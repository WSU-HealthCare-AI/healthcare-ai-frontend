import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Calendar, Dumbbell } from 'lucide-react-native';
import { RoutineDay, Exercise, WorkoutPlan } from '@/src/entities/recommendation/model/schema';

interface WorkoutPlanWidgetProps {
  workoutPlan: WorkoutPlan;
  currentDay: number;
  onStartWorkout: () => void;
}

export function WorkoutPlanWidget({
  workoutPlan,
  currentDay,
  onStartWorkout,
}: WorkoutPlanWidgetProps) {
  const todayRoutine: RoutineDay =
    workoutPlan.weekly_routine.find((day) => day.day === currentDay) ||
    workoutPlan.weekly_routine.find((day) => !day.is_rest_day) ||
    workoutPlan.weekly_routine[0];

  return (
    <View className="mt-6 rounded-3xl bg-blue-600 p-6 shadow-lg shadow-blue-200">
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Calendar size={17} color="white" />
          {/* 직관적인 day progression 안내 추가 */}
          <Text className="ml-2 px-1 text-base font-bold text-white">
            오늘의 운동 플랜 <Text className="font-normal opacity-80">· {currentDay}일차</Text>
          </Text>
        </View>
      </View>

      <View className="mb-4 rounded-2xl bg-white/10 p-4">
        <View className="mb-2 flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center pr-2">
            <Dumbbell size={20} color="white" />
            <Text className="text-md ml-3 font-bold text-white" numberOfLines={1}>
              {todayRoutine.is_rest_day ? '오늘은 휴식일입니다' : todayRoutine.daily_target}
            </Text>
          </View>
          {!todayRoutine.is_rest_day && (
            <Text className="text-sm font-medium text-blue-100">
              총 {todayRoutine.exercises?.length || 0}개 동작
            </Text>
          )}
        </View>

        {!todayRoutine.is_rest_day && todayRoutine.exercises && (
          <View className="mt-2 flex-row flex-wrap gap-2">
            {todayRoutine.exercises.slice(0, 4).map((ex: Exercise, idx: number) => (
              <View key={`tag-${idx}`} className="rounded-full bg-white/20 px-3 py-1.5">
                <Text className="text-xs font-medium text-white">{ex.name}</Text>
              </View>
            ))}
            {todayRoutine.exercises.length > 4 && (
              <View className="rounded-full bg-white/20 px-3 py-1.5">
                <Text className="text-xs font-medium text-white">
                  +{todayRoutine.exercises.length - 4}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      <TouchableOpacity
        className={`items-center rounded-2xl py-3.5 shadow-sm active:opacity-90 ${todayRoutine.is_rest_day ? 'bg-blue-800' : 'bg-white'}`}
        onPress={onStartWorkout}>
        <Text
          className={`text-base font-bold ${todayRoutine.is_rest_day ? 'text-white' : 'text-blue-600'}`}>
          {todayRoutine.is_rest_day ? '주간 플랜 확인하기' : '오늘의 운동 시작하기'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
