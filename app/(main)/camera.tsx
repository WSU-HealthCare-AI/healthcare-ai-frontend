import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pause, Square } from 'lucide-react-native';
import { WorkoutCameraWidget } from '@/src/widgets/workout-camera/ui/WorkoutCameraWidget';

export default function CameraScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-black">
      {/* 핵심 비전 및 렌더링 로직은 WorkoutCameraWidget 내부에 캡슐화됨 */}
      <WorkoutCameraWidget />

      {/* 상단/하단 UI 오버레이 (Absolute 포지셔닝) */}
      <SafeAreaView
        edges={['top']}
        className="pointer-events-none absolute top-0 z-50 w-full px-6 pt-4">
        <View className="flex-row items-center justify-between">
          <View className="rounded-full bg-black/40 px-4 py-2 backdrop-blur-md">
            <Text className="font-bold text-white">AI 자세 분석 중</Text>
          </View>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} className="absolute bottom-0 z-50 w-full px-6 pb-8">
        <View className="flex-row items-end justify-between">
          <View>
            <Text className="mb-2 text-6xl font-extrabold text-white">
              00 <Text className="text-3xl font-medium text-gray-300">/ 15</Text>
            </Text>
            <View className="mt-1 flex-row gap-6">
              <View>
                <Text className="text-sm font-medium text-gray-400">운동 시간</Text>
                <Text className="mt-1 text-xl font-bold text-white">00:00</Text>
              </View>
              <View>
                <Text className="text-sm font-medium text-gray-400">소모 칼로리</Text>
                <Text className="mt-1 text-xl font-bold text-white">0 kcal</Text>
              </View>
            </View>
          </View>

          <View className="flex-row gap-4">
            <TouchableOpacity className="h-16 w-16 items-center justify-center rounded-full bg-white/20">
              <Pause color="white" size={28} fill="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/workout')}
              className="h-16 w-16 items-center justify-center rounded-full bg-red-500">
              <Square color="white" size={24} fill="white" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
