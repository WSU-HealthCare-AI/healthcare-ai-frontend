import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  CheckCircle2,
  User,
  Activity,
  Target,
  ChevronRight,
  PartyPopper,
  Stethoscope,
  ClipboardList,
} from 'lucide-react-native';

import { Button } from '@/src/shared/ui/Button';
import { OnboardingHeader } from '@/src/widgets/header/ui/OnboardingHeader';
import { useRegistrationStore } from '@/src/entities/user/model/store';

export default function OnboardingCompleteScreen() {
  const router = useRouter();
  const { account, profile } = useRegistrationStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isGoogle = account.authProvider === 'google';
  const currentStep = isGoogle ? 3 : 4;
  const totalSteps = isGoogle ? 3 : 4;

  const handleFinalStart = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);

    // 실제 환경에서는 여기서 Supabase Auth 및 Database API를 호출
    const finalData = {
      auth: account,
      user_profile: profile,
      created_at: new Date().toISOString(),
    };

    console.log('--- 최종 가입 데이터 서버 전송 ---');
    console.log(JSON.stringify(finalData, null, 2));

    // API 지연 시뮬레이션 (1.5초)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsSubmitting(false);

    // 가입 완료 후 메인 대시보드로 이동
    router.replace('/(main)');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <OnboardingHeader currentStep={currentStep} totalSteps={totalSteps} />

      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}>
        {/* 성공 축하 섹션 */}
        <View className="mb-10 mt-8 items-center">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-blue-50">
            <PartyPopper size={40} color="#2563EB" />
          </View>
          <Text className="text-center text-3xl font-bold leading-tight text-gray-900">
            준비 완료!{'\n'}
            {account.email ? account.email.split('@')[0] : '회원'}님 반가워요
          </Text>
          <Text className="mt-2 text-center text-base text-gray-500">
            AI가 분석한 맞춤형 플랜이 생성되었습니다.
          </Text>
        </View>

        {/* 데이터 요약 카드 섹션 */}
        <View className="space-y-4">
          {/* 기본 정보 요약 */}
          <SummaryCard
            icon={<User size={18} color="#4B5563" />}
            title="기본 정보"
            onPress={() => router.push('/onboarding')}>
            <Text className="text-gray-600">
              {profile.gender || '미설정'} · {profile.height || '--'}cm · {profile.weight || '--'}kg
            </Text>
          </SummaryCard>

          {/* 운동 목적 요약 */}
          <SummaryCard
            icon={<Target size={18} color="#4B5563" />}
            title="운동 목적"
            onPress={() => router.push('/onboarding')}>
            <View className="flex-row flex-wrap">
              {profile.purposes && profile.purposes.length > 0 ? (
                profile.purposes.map((p, i) => (
                  <Text key={`${p}-${i}`} className="text-gray-600">
                    {p}
                    {i !== (profile.purposes?.length || 0) - 1 ? ', ' : ''}
                  </Text>
                ))
              ) : (
                <Text className="italic text-gray-400">미선택</Text>
              )}
            </View>
          </SummaryCard>

          {/* 통증 및 질환 요약 */}
          <SummaryCard
            icon={<Stethoscope size={18} color="#4B5563" />}
            title="통증 및 기저 질환"
            onPress={() => router.push('/onboarding')}>
            <View>
              <Text className="text-sm text-gray-600">
                <Text className="font-bold">통증: </Text>
                {profile.painPoints && profile.painPoints.length > 0
                  ? profile.painPoints.join(', ')
                  : '없음'}
              </Text>
              <Text className="mt-1 text-sm text-gray-600">
                <Text className="font-bold">질환: </Text>
                {profile.diseases && profile.diseases.length > 0
                  ? profile.diseases.join(', ')
                  : '없음'}
              </Text>
            </View>
          </SummaryCard>

          {/* 수술 이력 및 복용 약물 */}
          <SummaryCard
            icon={<ClipboardList size={18} color="#4B5563" />}
            title="수술 이력 및 복용 약물"
            onPress={() => router.push('/onboarding')}>
            <Text className="text-sm text-gray-600" numberOfLines={2}>
              {profile.surgeryHistory || '해당 사항 없음'}
            </Text>
          </SummaryCard>

          {/* 인바디 정보 요약 */}
          <SummaryCard
            icon={<Activity size={18} color="#4B5563" />}
            title="인바디 데이터"
            onPress={() => router.push('/onboarding/inbody')}>
            {profile.muscleMass ? (
              <Text className="font-bold text-blue-600">
                근육량 {profile.muscleMass}kg · 체지방 {profile.fatPercentage}%
              </Text>
            ) : (
              <Text className="text-sm italic text-gray-400">등록된 정보 없음</Text>
            )}
          </SummaryCard>
        </View>

        <View className="mb-6 mt-10 rounded-2xl border border-gray-100 bg-gray-50 p-5">
          <View className="mb-2 flex-row items-center">
            <CheckCircle2 size={16} color="#10B981" />
            <Text className="ml-2 font-bold text-gray-900">AI 맞춤 분석 완료</Text>
          </View>
          <Text className="text-sm leading-relaxed text-gray-500">
            입력하신 정보를 바탕으로 {profile.purposes?.[0] || '건강 관리'}를 위한 최적화된 운동
            루틴과 식단 가이드를 준비했습니다.
          </Text>
        </View>

        {/* 최종 시작 버튼 */}
        <View className="mb-10 mt-auto pt-4">
          <Button
            label={isSubmitting ? '플랜 생성 중...' : 'FitMate 시작하기'}
            variant="primary"
            onPress={handleFinalStart}
            isLoading={isSubmitting}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// 요약 카드 컴포넌트 (내부용)

interface SummaryCardProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  onPress: () => void;
}

const SummaryCard = ({ icon, title, children, onPress }: SummaryCardProps) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    className="flex-row items-center justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
    <View className="flex-1 flex-row items-center">
      <View className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-gray-50">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
          {title}
        </Text>
        {children}
      </View>
    </View>
    <ChevronRight size={18} color="#D1D5DB" />
  </TouchableOpacity>
);
