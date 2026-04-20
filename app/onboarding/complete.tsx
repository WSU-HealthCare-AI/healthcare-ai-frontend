import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
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
  CalendarDays,
} from 'lucide-react-native';

import { Button } from '@/src/shared/ui/Button';
import { OnboardingHeader } from '@/src/widgets/header/ui/OnboardingHeader';
import { useRegistrationStore } from '@/src/entities/user/model/store';
import { supabase } from '@/src/shared/api/supabase';
import { useAuthStore } from '@/src/entities/user/model/authStore';
import type { InbodyRecord, FlexValue } from '@/src/entities/inbody/model/types';

export default function OnboardingCompleteScreen() {
  const router = useRouter();
  const { account, profile, reset } = useRegistrationStore();
  const { checkAndFetchProfile, fetchLatestInbody } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inbodyData = profile.inbodyData as InbodyRecord | null | undefined;

  const isGoogle = account.authProvider === 'google';
  const currentStep = isGoogle ? 3 : 4;
  const totalSteps = isGoogle ? 3 : 4;

  const toNumberSafe = (value: FlexValue | string | number | undefined): number | null => {
    if (value == null || value === '') return null;
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(num) ? null : num;
  };

  const calculateAge = (birthDate?: string) => {
    if (!birthDate || birthDate.length !== 8) return '';

    const year = parseInt(birthDate.substring(0, 4), 10);
    const month = parseInt(birthDate.substring(4, 6), 10) - 1;
    const day = parseInt(birthDate.substring(6, 8), 10);

    const today = new Date();
    const birth = new Date(year, month, day);

    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  };

  const handleFinalStart = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('유저 정보를 찾을 수 없습니다. 다시 로그인해 주세요.');
      }

      const finalWeight =
        toNumberSafe(inbodyData?.weight_kg) ?? toNumberSafe(profile.weight) ?? null;
      const heightCm = toNumberSafe(profile.height);
      const heightInM = heightCm ? heightCm / 100 : null;
      const calculatedBmi = heightInM && finalWeight ? finalWeight / (heightInM * heightInM) : null;

      const profilePayload = {
        user_id: user.id,
        name: profile.name,
        gender: profile.gender,
        birth_date: profile.birthDate,
        height: heightCm,
        weight: finalWeight,
        bmi: calculatedBmi ? Number(calculatedBmi.toFixed(1)) : null,
        purposes: profile.purposes || [],
        exercise_frequency: profile.exerciseFrequency || null,
        diseases: profile.diseases || [],
        allergies: profile.allergies || null,
        surgery_history: profile.surgeryHistory || null,
        pain_points: profile.painPoints || [],
      };

      console.log('[COMPLETE][PROFILE_PAYLOAD]', profilePayload);

      const { error: profileError, data: profileData } = await supabase
        .from('health_profiles')
        .upsert(profilePayload, { onConflict: 'user_id' })
        .select();

      console.log('[COMPLETE][PROFILE_RESULT]', profileData);

      if (profileError) {
        console.error('[COMPLETE][HEALTH_PROFILE_ERROR]', profileError);
        throw new Error('프로필 저장 중 문제가 발생했습니다.');
      }

      if (inbodyData) {
        const inbodyPayload = {
          user_id: user.id,
          measured_at: inbodyData.measured_at ?? new Date().toISOString().split('T')[0],
          total_body_water_l: toNumberSafe(inbodyData.total_body_water_L),
          protein_kg: toNumberSafe(inbodyData.protein_kg),
          minerals_kg: toNumberSafe(inbodyData.minerals_kg),
          body_fat_mass_kg: toNumberSafe(inbodyData.body_fat_mass_kg),
          weight_kg: toNumberSafe(inbodyData.weight_kg),
          skeletal_muscle_mass_kg: toNumberSafe(inbodyData.skeletal_muscle_mass_kg),
          bmi: toNumberSafe(inbodyData.bmi),
          body_fat_percentage: toNumberSafe(inbodyData.body_fat_percentage),
          segmental_lean: inbodyData.segmental_lean ?? null,
          image_url: inbodyData.image_url ?? null,
          raw_ocr_text: inbodyData.raw_ocr_text ?? null,
        };

        console.log('[COMPLETE][INBODY_DATA_RAW]', inbodyData);
        console.log('[COMPLETE][INBODY_PAYLOAD_KEYS]', Object.keys(inbodyPayload));
        console.log('[COMPLETE][INBODY_PAYLOAD]', inbodyPayload);

        const { error: inbodyError, data: inbodyInsertData } = await supabase
          .from('inbody_records')
          .insert(inbodyPayload)
          .select();

        console.log('[COMPLETE][INBODY_INSERT_RESULT]', inbodyInsertData);

        if (inbodyError) {
          console.error('[COMPLETE][INBODY_INSERT_ERROR]', inbodyError);
          console.error('[COMPLETE][INBODY_DEBUG]', {
            measured_at: inbodyPayload.measured_at,
            total_body_water_L: inbodyPayload.total_body_water_l,
            protein_kg: inbodyPayload.protein_kg,
            minerals_kg: inbodyPayload.minerals_kg,
            body_fat_mass_kg: inbodyPayload.body_fat_mass_kg,
            weight_kg: inbodyPayload.weight_kg,
            skeletal_muscle_mass_kg: inbodyPayload.skeletal_muscle_mass_kg,
            bmi: inbodyPayload.bmi,
            body_fat_percentage: inbodyPayload.body_fat_percentage,
            segmental_lean_type: typeof inbodyPayload.segmental_lean,
            image_url: inbodyPayload.image_url,
            raw_ocr_text_length: inbodyPayload.raw_ocr_text?.length ?? 0,
          });

          Alert.alert(
            '인바디 저장 실패',
            `health_profiles는 저장됐을 가능성이 높고, inbody_records만 실패했습니다.\n\ncode: ${inbodyError.code ?? '-'}\nmessage: ${inbodyError.message ?? '-'}`
          );
          return;
        }
      }

      await checkAndFetchProfile(user.id);
      await fetchLatestInbody(user.id);

      reset();
      router.replace('/(main)');
    } catch (error: any) {
      console.error('[COMPLETE][FINAL_ERROR]', error);
      Alert.alert('저장 실패', error.message || '데이터베이스 저장 중 문제가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <OnboardingHeader currentStep={currentStep} totalSteps={totalSteps} />

      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}>
        <View className="mb-8 items-center">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-green-50">
            <PartyPopper size={36} color="#16A34A" />
          </View>

          <Text className="text-center text-3xl font-bold leading-tight text-gray-900">
            준비 완료!{'\n'}
            {profile.name}님 반가워요
          </Text>

          <Text className="mt-3 text-center text-base text-gray-500">
            AI가 분석한 맞춤형 플랜을 경험하세요!
          </Text>
        </View>

        <View className="space-y-3">
          <SummaryCard
            icon={<User size={18} color="#3B82F6" />}
            title="기본 정보"
            onPress={() => router.push('/onboarding')}>
            <Text className="text-sm font-medium text-gray-900">
              {profile.name} (만 {calculateAge(profile.birthDate)}세)
            </Text>
            <Text className="mt-1 text-sm text-gray-500">
              {profile.gender || '미설정'} · {profile.height || '--'}cm ·{' '}
              {inbodyData?.weight_kg || profile.weight || '--'}kg
            </Text>
          </SummaryCard>

          <SummaryCard
            icon={<Target size={18} color="#8B5CF6" />}
            title="운동 목적"
            onPress={() => router.push('/onboarding')}>
            <Text className="text-sm text-gray-600">
              {profile.purposes && profile.purposes.length > 0
                ? profile.purposes.join(', ')
                : '미선택'}
            </Text>
          </SummaryCard>

          <SummaryCard
            icon={<CalendarDays size={18} color="#F59E0B" />}
            title="운동 주기"
            onPress={() => router.push('/onboarding')}>
            <Text className="text-sm text-gray-600">{profile.exerciseFrequency || '미선택'}</Text>
          </SummaryCard>

          <SummaryCard
            icon={<Stethoscope size={18} color="#EF4444" />}
            title="통증 및 기저 질환"
            onPress={() => router.push('/onboarding')}>
            <Text className="text-sm text-gray-600">
              통증:{' '}
              {profile.painPoints && profile.painPoints.length > 0
                ? profile.painPoints.join(', ')
                : '없음'}
            </Text>
            <Text className="mt-1 text-sm text-gray-600">
              질환:{' '}
              {profile.diseases && profile.diseases.length > 0
                ? profile.diseases.join(', ')
                : '없음'}
            </Text>
          </SummaryCard>

          <SummaryCard
            icon={<ClipboardList size={18} color="#10B981" />}
            title="수술 이력 및 복용 약물"
            onPress={() => router.push('/onboarding')}>
            <Text className="text-sm text-gray-600">
              {profile.surgeryHistory || '해당 사항 없음'}
            </Text>
            <Text className="mt-1 text-sm text-gray-600">
              알러지: {profile.allergies || '없음'}
            </Text>
          </SummaryCard>

          <SummaryCard
            icon={<Activity size={18} color="#14B8A6" />}
            title="인바디 데이터"
            onPress={() => router.push('/onboarding/inbody')}>
            {inbodyData ? (
              <>
                <Text className="text-sm text-gray-600">체중 {inbodyData.weight_kg ?? '-'}kg</Text>
                <Text className="mt-1 text-sm text-gray-600">
                  골격근량 {inbodyData.skeletal_muscle_mass_kg ?? '-'}kg · 체지방률{' '}
                  {inbodyData.body_fat_percentage ?? '-'}%
                </Text>
                <Text className="mt-1 text-sm text-gray-600">
                  체수분 {inbodyData.total_body_water_L ?? '-'}L · BMI {inbodyData.bmi ?? '-'}
                </Text>
              </>
            ) : (
              <Text className="text-sm text-gray-400">등록된 정보 없음</Text>
            )}
          </SummaryCard>
        </View>

        <View className="mt-8 rounded-2xl bg-blue-50 p-5">
          <View className="mb-2 flex-row items-center">
            <CheckCircle2 size={18} color="#2563EB" />
            <Text className="ml-2 font-bold text-blue-900">AI 맞춤 분석 준비</Text>
          </View>
          <Text className="text-sm leading-6 text-blue-800">
            입력하신 정보를 바탕으로 {profile.purposes?.[0] || '건강 관리'}를 위한 최적화된 운동
            루틴과 식단 가이드를 준비할게요!
          </Text>
        </View>

        <View className="mt-8">
          <Button
            label={isSubmitting ? '저장 중...' : '시작하기'}
            variant="primary"
            onPress={handleFinalStart}
            isLoading={isSubmitting}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface SummaryCardProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  onPress: () => void;
}

function SummaryCard({ icon, title, children, onPress }: SummaryCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="mb-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <View className="flex-row items-start justify-between">
        <View className="mr-4 flex-1">
          <View className="mb-2 flex-row items-center">
            <View className="mr-2">{icon}</View>
            <Text className="text-base font-bold text-gray-900">{title}</Text>
          </View>
          <View>{children}</View>
        </View>

        <ChevronRight size={18} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );
}
