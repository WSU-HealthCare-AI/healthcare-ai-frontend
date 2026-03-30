import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Camera, FileText, RefreshCw, ChevronRight, Info } from 'lucide-react-native';

import { Button } from '@/src/shared/ui/Button';
import { OnboardingHeader } from '@/src/widgets/header/ui/OnboardingHeader';
import { useRegistrationStore } from '@/src/entities/user/model/store';

export default function InBodyScanScreen() {
  const router = useRouter();
  const { account, setProfile, profile } = useRegistrationStore();

  // 상태 관리: 스캔 중 여부 및 결과 존재 여부
  const [isScanning, setIsScanning] = useState(false);
  const [hasResult, setHasResult] = useState(false);

  // 현재 가입 경로에 따른 스텝 계산 (이메일 4단계 / 구글 3단계)
  const isGoogle = account.authProvider === 'google';
  const currentStep = isGoogle ? 2 : 3;
  const totalSteps = isGoogle ? 3 : 4;

  const handleStartScan = () => {
    setIsScanning(true);

    // 실제 기기에서는 Vision AI/OCR 라이브러리가 호출되어 텍스트를 파싱하는 구간
    setTimeout(() => {
      setIsScanning(false);
      setHasResult(true);

      setProfile({
        muscleMass: '34.2',
        fatPercentage: '15.8',
        bmi: '23.1',
      });
    }, 2000);
  };

  const onNext = () => {
    router.push('/onboarding/complete');
  };

  const onSkip = () => {
    router.push('/onboarding/complete');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <OnboardingHeader currentStep={currentStep} totalSteps={totalSteps} />

      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}>
        {/* 상단 타이틀 섹션 */}
        <View className="mb-6 mt-8">
          <Text className="mb-2 text-2xl font-bold leading-tight text-gray-900">
            인바디 결과지를{'\n'}스캔해 주세요
          </Text>
          <Text className="text-base leading-relaxed text-gray-500">
            카메라로 결과지를 비추면 AI가{'\n'}필요한 데이터를 자동으로 읽어와요.
          </Text>
        </View>

        {/* 카메라/스캔 영역 UI */}
        <View className="relative aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-gray-200 bg-gray-100">
          {!hasResult ? (
            <View className="items-center px-10">
              <Camera size={48} color="#9CA3AF" strokeWidth={1.2} />
              <Text className="mt-4 text-center leading-relaxed text-gray-400">
                결과지 전체가 사각형 안에{'\n'}잘 들어오도록 맞춰주세요
              </Text>

              {/* 스캔 진행 중 오버레이 애니메이션 효과용 */}
              {isScanning && (
                <View className="absolute inset-0 items-center justify-center bg-black/10">
                  <ActivityIndicator size="large" color="#2563EB" />
                  <Text className="mt-4 font-bold text-blue-600">데이터 추출 중...</Text>
                </View>
              )}
            </View>
          ) : (
            <View className="h-full w-full bg-blue-50/30 p-8">
              <View className="mb-6 flex-row items-center">
                <FileText size={20} color="#2563EB" />
                <Text className="ml-2 text-lg font-bold text-blue-600">인식된 데이터</Text>
              </View>

              <View className="space-y-6">
                <ResultRow label="골격근량" value={`${profile.muscleMass}kg`} />
                <ResultRow label="체지방률" value={`${profile.fatPercentage}%`} />
                <ResultRow label="BMI" value={profile.bmi || '-'} />
              </View>

              {/* 재촬영 버튼 */}
              <TouchableOpacity
                onPress={() => setHasResult(false)}
                className="mt-auto flex-row items-center justify-center rounded-2xl border border-blue-100 bg-white py-4 active:opacity-70">
                <RefreshCw size={16} color="#3B82F6" />
                <Text className="ml-2 font-bold text-blue-600">다시 촬영하기</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 유도 문구 및 팁 */}
        <View className="mt-6 flex-row items-start rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <Info size={16} color="#9CA3AF" className="mt-0.5" />
          <Text className="ml-2 flex-1 text-xs leading-relaxed text-gray-500">
            인바디 결과지가 없어도 괜찮아요. 건너뛰기를 누르시면 추후 마이페이지에서 직접 등록하실
            수 있습니다.
          </Text>
        </View>

        {/* 하단 액션 버튼 영역 */}
        <View className="mb-10 mt-auto pt-8">
          {!hasResult ? (
            <>
              <Button
                label={isScanning ? '인식 중...' : '스캔 시작하기'}
                variant="primary"
                onPress={handleStartScan}
                isLoading={isScanning}
              />
              <TouchableOpacity
                onPress={onSkip}
                className="mt-4 flex-row items-center justify-center py-2 active:opacity-50">
                <Text className="mr-1 font-medium text-gray-400">다음에 할게요</Text>
                <ChevronRight size={16} color="#D1D5DB" />
              </TouchableOpacity>
            </>
          ) : (
            <Button label="이 정보로 가입 완료" variant="primary" onPress={onNext} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// 인식 결과 행 컴포넌트
const ResultRow = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-row items-center justify-between border-b border-blue-100/30 py-4">
    <Text className="text-base font-medium text-gray-500">{label}</Text>
    <Text className="text-xl font-bold text-gray-900">{value}</Text>
  </View>
);
