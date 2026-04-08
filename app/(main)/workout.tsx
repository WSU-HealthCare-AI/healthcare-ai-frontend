import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Play, Clock, Zap, ChevronRightIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';

// 운동 탭
export default function WorkoutScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 py-4">
        <Text className="text-2xl font-bold text-gray-900">운동하기</Text>
        <Text className="mt-1 text-gray-500">AI 코치가 실시간으로 자세를 봐드려요.</Text>
      </View>

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        {/* 메인 AI 운동 카드 */}
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

          <Text className="mb-2 text-3xl font-bold text-white">실시간 스쿼트</Text>

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Clock size={16} color="white" opacity={0.7} />
              <Text className="opacity-0.9 ml-1 mr-4 text-sm text-white">15분</Text>
            </View>
            <View className="flex-row items-center">
              <Zap size={16} color="white" opacity={0.7} />
              <Text className="opacity-0.9 ml-1 text-sm text-white">고강도</Text>
            </View>
            <View className="ml-auto rounded-full bg-white p-4">
              <Play size={24} color="#2563EB" fill="#2563EB" />
            </View>
          </View>
        </TouchableOpacity>

        <Text className="mb-4 mt-10 text-xl font-bold text-gray-900">준비된 운동</Text>

        {/* 리스트 아이템들 (더미) */}
        <WorkoutItem title="푸쉬업 자세 교정" duration="10분" difficulty="중급" />
        <WorkoutItem title="런지 밸런스 체크" duration="12분" difficulty="초급" />
        <WorkoutItem title="플랭크 코어 유지" duration="5분" difficulty="상급" />
      </ScrollView>
    </SafeAreaView>
  );
}

const WorkoutItem = ({
  title,
  duration,
  difficulty,
}: {
  title: string;
  duration: string;
  difficulty: string;
}) => (
  <TouchableOpacity className="mb-4 flex-row items-center rounded-2xl border border-gray-100 bg-gray-50 p-4">
    <View className="mr-4 h-12 w-12 items-center justify-center rounded-full bg-blue-100">
      <Zap size={20} color="#3b82f6" />
    </View>
    <View className="flex-1">
      <Text className="font-bold text-gray-900">{title}</Text>
      <Text className="text-sm text-gray-500">
        {duration} · {difficulty}
      </Text>
    </View>
    <ChevronRightIcon size={20} color="#cbd5e1" />
  </TouchableOpacity>
);
