import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Calendar, Dumbbell } from 'lucide-react-native';

// AI 추천 운동 데이터 타입 정의
interface Exercise {
  name: string;
  reason: string;
  sets: number;
  reps: string;
  rest_sec: number;
  cautions: string;
}

interface WorkoutPlanWidgetProps {
  workoutPlan: {
    weekly_frequency: number;
    intensity: number;
    exercises: Exercise[];
  };
  onStartWorkout: () => void;
}

export function WorkoutPlanWidget({ workoutPlan, onStartWorkout }: WorkoutPlanWidgetProps) {
  return (
    <View className="mt-6 rounded-3xl bg-blue-600 p-6 shadow-lg shadow-blue-200">
      <View className="mb-4 flex-row items-center">
        <Calendar size={17} color="white" />
        <Text className="ml-2 px-1 text-base font-bold text-white">AI 추천 운동 플랜</Text>
      </View>

      <View className="mb-4 rounded-2xl bg-white/10 p-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center pr-2">
            <Dumbbell size={20} color="white" />
            <Text className="ml-3 text-lg font-bold text-white" numberOfLines={1}>
              맞춤형 맨몸 루틴 Level {workoutPlan.intensity}
            </Text>
          </View>
          <Text className="text-sm font-medium text-blue-100">
            총 {workoutPlan.exercises.length}개 동작
          </Text>
        </View>

        {/* AI 추천 운동 태그들 */}
        <View className="mt-4 flex-row flex-wrap gap-2">
          {workoutPlan.exercises.slice(0, 4).map((ex, idx) => (
            <View key={`tag-${ex.name}-${idx}`} className="rounded-full bg-white/20 px-3 py-1.5">
              <Text className="text-xs font-medium text-white">{ex.name}</Text>
            </View>
          ))}
          {workoutPlan.exercises.length > 4 && (
            <View className="rounded-full bg-white/20 px-3 py-1.5">
              <Text className="text-xs font-medium text-white">
                +{workoutPlan.exercises.length - 4}
              </Text>
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="추천 운동 시작하기"
        accessibilityHint="오늘의 추천 맨몸 운동을 시작하는 화면으로 이동합니다."
        className="items-center rounded-2xl bg-white py-3.5 shadow-sm active:opacity-90"
        onPress={onStartWorkout}>
        <Text className="text-base font-bold text-blue-600">추천 운동 시작하기</Text>
      </TouchableOpacity>
    </View>
  );
}
