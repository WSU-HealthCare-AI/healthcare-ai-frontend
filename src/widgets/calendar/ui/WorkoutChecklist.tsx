import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Activity, CheckCircle2 } from 'lucide-react-native';

export interface WorkoutChecklistProps {
  todayWorkoutPlan: any;
  selectedLog: any;
  toggleExercise: (name: string) => void;
  isCheckableDate: boolean;
}

export function WorkoutChecklist({
  todayWorkoutPlan,
  selectedLog,
  toggleExercise,
  isCheckableDate,
}: WorkoutChecklistProps) {
  return (
    <View className="mb-6">
      <View className="mb-3 flex-row items-center">
        <Activity size={20} color="#2563EB" />
        <Text className="ml-2 text-base font-bold text-gray-800">맞춤 운동 리스트</Text>
      </View>

      {todayWorkoutPlan?.is_rest_day ? (
        <View className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <Text className="text-sm font-semibold text-gray-600">휴식 및 건강 회복일입니다.</Text>
          <Text className="mt-1 text-xs text-gray-400">
            가벼운 스트레칭과 폼롤러 마사지로 신체 긴장을 완화하세요.
          </Text>
        </View>
      ) : (
        todayWorkoutPlan?.exercises?.map((exercise: any, i: number) => {
          const isCompleted = selectedLog?.completed_exercises?.includes(exercise.name) ?? false;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => toggleExercise(exercise.name)}
              disabled={!isCheckableDate}
              className={`mb-2.5 flex-row items-center rounded-xl border border-gray-100 bg-gray-50 p-3.5 ${
                isCheckableDate ? '' : 'opacity-50'
              }`}>
              <CheckCircle2 size={22} color={isCompleted ? '#10B981' : '#D1D5DB'} />
              <View className="ml-3 flex-1">
                <Text
                  className={`text-sm font-semibold ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                  {exercise.name} ({exercise.reps} x {exercise.sets}세트)
                </Text>
                <Text className="mt-0.5 text-xs text-gray-500">{exercise.reason}</Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}
