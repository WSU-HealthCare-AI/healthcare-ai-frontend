import React from 'react';
import { View, Text } from 'react-native';
import { Dumbbell, Info } from 'lucide-react-native';

// AI 추천 운동 데이터 타입 정의
interface Exercise {
  name: string;
  reason: string;
  sets: number;
  reps: string;
  rest_sec: number;
  cautions: string;
}

interface RoutineListWidgetProps {
  exercises: Exercise[];
}

export function RoutineListWidget({ exercises }: RoutineListWidgetProps) {
  return (
    <View>
      <View className="mb-4 mt-4 flex-row items-center px-1">
        <Dumbbell size={20} color="#3B82F6" />
        <Text className="ml-2 text-lg font-bold text-gray-900">세부 루틴 안내</Text>
      </View>

      {exercises.map((exercise, index) => (
        <View
          key={`${exercise.name}-${index}`}
          className="mb-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="flex-1 pr-2 text-lg font-bold text-gray-900">{exercise.name}</Text>
            <View className="rounded-full bg-blue-50 px-3 py-1">
              <Text className="text-sm font-bold text-blue-600">
                {exercise.sets}세트 × {exercise.reps}
              </Text>
            </View>
          </View>

          <Text className="mb-4 text-sm leading-5 text-gray-600">{exercise.reason}</Text>

          <View className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <View className="flex-row items-start">
              <Info size={16} color="#6B7280" className="mr-2 mt-0.5 flex-shrink-0" />
              <View className="flex-1">
                <Text className="mb-1 text-xs font-bold text-gray-500">수행 팁 및 주의사항</Text>
                <Text className="text-sm leading-5 text-gray-700">{exercise.cautions}</Text>
                <Text className="mt-2 text-xs font-medium text-blue-500">
                  ⏱️ 세트 간 휴식: {exercise.rest_sec}초
                </Text>
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
