import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

export interface OnboardingHeaderProps {
  currentStep: number;
  totalSteps: number;
}

// 온보딩 전용 헤더 위젯
export const OnboardingHeader = ({ currentStep, totalSteps }: OnboardingHeaderProps) => {
  const router = useRouter();

  const progressPercentage = (currentStep / totalSteps) * 100;

  // 뒤로가기 안전 처리 핸들 네비게이션 스택이 비어있는 경우 'GO_BACK' 에러가 발생하는 것을 방지
  const handleBack = () => {
    // 뒤로 갈 수 있는 기록이 있는지 확인
    if (router.canGoBack()) {
      router.back();
    } else {
      // 기록이 없다면(구글 로그인 후 replace로 들어온 경우 등) 앱의 초기 화면으로 리다이렉트
      router.replace('/welcome');
    }
  };

  return (
    <View className="w-full flex-row items-center justify-between bg-white px-6 py-4">
      {/* 뒤로가기 버튼 */}
      <TouchableOpacity
        onPress={handleBack}
        className="-ml-2 p-2 active:opacity-50"
        accessibilityLabel="뒤로가기">
        <ChevronLeft size={28} color="#111827" strokeWidth={2.5} />
      </TouchableOpacity>

      {/* 프로그레스 바 영역 */}
      <View className="relative mx-4 h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
        <View
          className="absolute bottom-0 left-0 top-0 rounded-full bg-blue-600"
          style={{ width: `${progressPercentage}%` }}
        />
      </View>

      {/* 스텝 카운트 표시 */}
      <View className="w-10 items-end">
        <Text className="text-sm font-bold text-blue-600">
          {currentStep}
          <Text className="text-gray-300">/{totalSteps}</Text>
        </Text>
      </View>
    </View>
  );
};
