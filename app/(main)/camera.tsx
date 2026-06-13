import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pause, Square, Play } from 'lucide-react-native';
import { WorkoutCameraWidget } from '@/src/widgets/workout-camera/ui/WorkoutCameraWidget';

export default function CameraScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // 1. 이전 프리뷰 라우터로부터 전달받은 운동 동작 명칭 획득 및 폴백 처리
  const workoutName = (params.workoutName as string) || '스쿼트 자세 분석';

  // 2. 타이머 및 개수 카운팅을 위한 기획안 피드백 상태 제어
  const [seconds, setSeconds] = useState(0);
  const [repCount, setRepCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [caloriesBurned, setCaloriesBurned] = useState(0);

  // 3. 지능적 칼로리 및 타이머 카운팅 시뮬레이션
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (!isPaused) {
      interval = setInterval(() => {
        setSeconds((prev) => {
          const nextSec = prev + 1;
          // 6초가 경과할 때마다 repCount를 1씩 동적으로 올려, AI 영점 시뮬레이션을 구현하고 setRepCount를 소모
          if (nextSec % 6 === 0) {
            setRepCount((r) => Math.min(r + 1, 15));
          }
          return nextSec;
        });
        // 맨몸 전신 운동 칼로리 소모 전폭 산술화
        setCaloriesBurned((prev) => parseFloat((prev + 0.15).toFixed(2)));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPaused]);

  // 경과 시간 포맷터 (분:초)
  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View className="flex-1 bg-black">
      {/* 4. 고성능 비전 AI 위젯 연동 및 가이드 명칭 동적 전달 */}
      <WorkoutCameraWidget onBack={() => router.back()} workoutName={workoutName} />

      {/* 상단 AI 상태 오버레이 */}
      <SafeAreaView
        edges={['top']}
        className="pointer-events-none absolute top-0 z-50 w-full px-6 pt-4">
        <View className="flex-row items-center justify-between">
          <View className="rounded-full border border-white/10 bg-black/50 px-4 py-2 backdrop-blur-md">
            <Text className="text-xs font-bold text-white">🤖 AI 실시간 동작 교정 중</Text>
          </View>
          <View className="rounded-full bg-blue-500/90 px-4 py-2 backdrop-blur-md">
            <Text className="text-xs font-bold text-white">{workoutName}</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* 하단 HUD 자세 제어 콘솔 패널 */}
      <SafeAreaView edges={['bottom']} className="absolute bottom-0 z-50 w-full px-6 pb-8">
        <View className="flex-row items-end justify-between">
          <View className="rounded-3xl border border-white/5 bg-black/55 p-4 backdrop-blur-lg">
            <Text className="text-sm font-medium text-gray-400">카운트 완료</Text>
            <Text className="mt-1 text-5xl font-extrabold text-[#00FFCC]">
              {repCount} <Text className="text-2xl font-semibold text-gray-300">/ 15</Text>
            </Text>

            <View className="mt-4 flex-row gap-6">
              <View>
                <Text className="text-[10px] font-medium text-gray-400">운동 경과</Text>
                <Text className="mt-1 text-lg font-bold text-white">{formatTime(seconds)}</Text>
              </View>
              <View>
                <Text className="text-[10px] font-medium text-gray-400">소모 에너지</Text>
                <Text className="mt-1 text-lg font-bold text-white">
                  {Math.floor(caloriesBurned)} kcal
                </Text>
              </View>
            </View>
          </View>

          {/* 세련된 제어 서클 버튼 */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => setIsPaused(!isPaused)}
              className="h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/20 active:bg-white/30">
              {isPaused ? (
                <Play color="white" size={24} fill="white" />
              ) : (
                <Pause color="white" size={24} fill="white" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/workout')}
              className="h-14 w-14 items-center justify-center rounded-full bg-rose-500 shadow-lg active:bg-rose-600">
              <Square color="white" size={22} fill="white" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
