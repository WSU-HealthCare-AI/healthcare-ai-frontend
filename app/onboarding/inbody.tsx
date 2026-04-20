import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Camera, RefreshCw, ChevronRight, Info, CheckCircle2 } from 'lucide-react-native';

import { Button } from '@/src/shared/ui/Button';
import { OnboardingHeader } from '@/src/widgets/header/ui/OnboardingHeader';
import { useRegistrationStore } from '@/src/entities/user/model/store';
import { useInbodyScanner } from '@/src/features/inbody-scan/model/useInbodyScanner';
import { ScannerCamera } from '@/src/widgets/inbody-scanner/ui/ScannerCamera';
import { ScanOverlay } from '@/src/widgets/inbody-scanner/ui/ScanOverlay';
import { ResultCard } from '@/src/widgets/inbody-scanner/ui/ResultCard';
import type { InbodyRecord } from '@/src/entities/inbody/model/types';

const MAIN_FIELDS: Array<[keyof InbodyRecord, string]> = [
  ['total_body_water_L', '체수분'],
  ['protein_kg', '단백질'],
  ['minerals_kg', '무기질'],
  ['body_fat_mass_kg', '체지방량'],
  ['weight_kg', '체중'],
  ['skeletal_muscle_mass_kg', '골격근량'],
  ['bmi', 'BMI'],
  ['body_fat_percentage', '체지방률'],
];

const SEGMENTAL_FIELDS: Array<[string, string]> = [
  ['right_arm', '오른팔'],
  ['left_arm', '왼팔'],
  ['trunk', '몸통'],
  ['right_leg', '오른다리'],
  ['left_leg', '왼다리'],
];

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== '';
}

function isCompleteInbody(data: Partial<InbodyRecord> | null): data is InbodyRecord {
  if (!data) return false;

  const mainOk = MAIN_FIELDS.every(([key]) => hasValue(data[key]));
  const seg = data.segmental_lean;
  const segmentalOk =
    !!seg && SEGMENTAL_FIELDS.every(([key]) => hasValue(seg[key as keyof typeof seg]));

  return mainOk && segmentalOk;
}

function SimpleResultList({ result }: { result: InbodyRecord }) {
  return (
    <View>
      <Row label="체수분" value={result.total_body_water_L} />
      <Row label="단백질" value={result.protein_kg} />
      <Row label="무기질" value={result.minerals_kg} />
      <Row label="체지방량" value={result.body_fat_mass_kg} />
      <Row label="체중" value={result.weight_kg} />
      <Row label="골격근량" value={result.skeletal_muscle_mass_kg} />
      <Row label="BMI" value={result.bmi} />
      <Row label="체지방률" value={result.body_fat_percentage} />
      <Row label="오른팔" value={result.segmental_lean?.right_arm} />
      <Row label="왼팔" value={result.segmental_lean?.left_arm} />
      <Row label="몸통" value={result.segmental_lean?.trunk} />
      <Row label="오른다리" value={result.segmental_lean?.right_leg} />
      <Row label="왼다리" value={result.segmental_lean?.left_leg} />
    </View>
  );
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <View className="flex-row items-center justify-between border-b border-gray-100 py-2">
      <Text className="text-sm text-gray-600">{label}</Text>
      <Text className="text-sm font-semibold text-gray-900">{value ?? '-'}</Text>
    </View>
  );
}

export default function InBodyScanScreen() {
  const router = useRouter();
  const { account, setProfile, profile } = useRegistrationStore();

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [inbodyData, setInbodyData] = useState<InbodyRecord | null>(null);

  const {
    status,
    framesSent,
    fieldsFound,
    partialResult,
    confidence,
    finalResult,
    startSession,
    sendFrame,
  } = useInbodyScanner();

  const isGoogle = account.authProvider === 'google';
  const currentStep = isGoogle ? 2 : 3;
  const totalSteps = isGoogle ? 3 : 4;

  const visibleResult = useMemo(
    () => (finalResult ?? partialResult ?? {}) as Partial<InbodyRecord>,
    [finalResult, partialResult]
  );

  const isReadyToConfirm = !!finalResult || status === 'complete';

  const handleStartScan = () => {
    setHasResult(false);
    setInbodyData(null);
    setIsCameraOpen(true);
    startSession();
  };

  const handleRetake = () => {
    setHasResult(false);
    setInbodyData(null);
    setIsCameraOpen(true);
    startSession();
  };

  const handleConfirmScan = () => {
    const confirmed = finalResult ?? partialResult;
    if (!isCompleteInbody(confirmed)) return;

    setInbodyData(confirmed);
    setHasResult(true);
    setIsCameraOpen(false);
  };

  const onSkip = () => {
    router.push('/onboarding/complete');
  };

  const onNext = () => {
    if (!inbodyData) return;

    setProfile({
      ...profile,
      inbodyData,
    });

    router.push('/onboarding/complete');
  };

  if (isCameraOpen) {
    return (
      <View className="flex-1 bg-black">
        <SafeAreaView className="flex-1">
          <View className="absolute top-10 z-10 w-full flex-row items-center justify-between px-4">
            <TouchableOpacity
              onPress={() => setIsCameraOpen(false)}
              className="rounded-full bg-black/50 px-4 py-2">
              <Text className="font-bold text-white">취소</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-1">
            <View className="flex-[0.48]">
              <ScannerCamera isScanning={status === 'scanning'} onFrame={sendFrame} />
              <ScanOverlay
                status={status}
                framesSent={framesSent}
                fieldsFound={fieldsFound}
                totalFields={13}
              />
            </View>

            <View className="flex-[0.52] rounded-t-3xl bg-zinc-50">
              <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}>
                <ResultCard
                  result={visibleResult}
                  confidence={confidence}
                  isFinal={isReadyToConfirm}
                />

                {!partialResult && !finalResult && (
                  <View className="mt-4 items-center justify-center py-8">
                    <Text className="text-center text-base font-semibold text-zinc-700">
                      인바디 결과지를 카메라에 비춰주세요
                    </Text>
                    <Text className="mt-2 text-center text-sm text-zinc-500">
                      인식된 항목이 아래에 실시간으로 표시됩니다.
                    </Text>
                  </View>
                )}

                {status === 'error' && (
                  <View className="mt-4 items-center rounded-2xl bg-red-50 px-4 py-4">
                    <Text className="font-semibold text-red-600">
                      스캔 연결에 문제가 발생했어요
                    </Text>
                    <TouchableOpacity
                      onPress={startSession}
                      className="mt-3 rounded-xl bg-zinc-900 px-5 py-3">
                      <Text className="font-bold text-white">다시 연결하기</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {isReadyToConfirm && (
                  <View className="mt-4 rounded-2xl bg-emerald-50 p-4">
                    <View className="flex-row items-center">
                      <CheckCircle2 size={18} color="#059669" />
                      <Text className="ml-2 font-bold text-emerald-700">
                        스캔 결과를 확인해 주세요
                      </Text>
                    </View>
                    <Text className="mt-2 text-sm leading-5 text-emerald-700">
                      모든 필수 항목 인식이 완료되었습니다. 값을 확인한 뒤 완료를 눌러 주세요.
                    </Text>

                    <View className="mt-4 flex-row gap-2">
                      <TouchableOpacity
                        onPress={handleRetake}
                        className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3">
                        <Text className="text-center font-semibold text-zinc-700">다시 스캔</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={handleConfirmScan}
                        className="flex-1 rounded-xl bg-zinc-900 px-4 py-3">
                        <Text className="text-center font-bold text-white">완료</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <OnboardingHeader currentStep={currentStep} totalSteps={totalSteps} />

      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}>
        <View className="mb-8 mt-6">
          <Text className="text-2xl font-bold leading-tight text-gray-900">
            인바디 결과지가 있으신가요?
          </Text>
          <Text className="mt-2 text-base text-gray-500">
            AI가 결과를 분석해 최적의 운동을 추천해드려요.
          </Text>
        </View>

        {hasResult && inbodyData ? (
          <View className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <View className="mb-4 flex-row items-center justify-between border-b border-gray-100 pb-3">
              <Text className="font-bold text-gray-900">인식 결과 확인</Text>

              <TouchableOpacity
                onPress={handleRetake}
                className="flex-row items-center active:opacity-50">
                <RefreshCw size={14} color="#6B7280" />
                <Text className="ml-1 text-xs text-gray-500">다시 찍기</Text>
              </TouchableOpacity>
            </View>

            <SimpleResultList result={inbodyData} />
          </View>
        ) : (
          <View className="mb-6 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 py-12">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-blue-50">
              <Camera size={32} color="#3B82F6" />
            </View>
            <Text className="mb-1 text-center font-bold text-gray-900">카메라로 스캔하기</Text>
            <Text className="text-center text-sm text-gray-500">
              더 나은 추천을 위해 인바디 결과지를 사용해주세요
            </Text>
          </View>
        )}

        <View className="mb-6 flex-row items-start rounded-xl bg-gray-50 p-4">
          <Info size={16} color="#9CA3AF" />
          <Text className="ml-2 flex-1 text-xs leading-relaxed text-gray-500">
            인바디 결과지가 없어도 괜찮아요. 건너뛰기를 누르시면 추후 마이페이지에서 직접 등록하실
            수 있습니다.
          </Text>
        </View>

        <View className="mb-10 mt-auto pt-8">
          {!hasResult ? (
            <>
              <Button
                label={status === 'connecting' ? '연결 중...' : '스캔 시작하기'}
                variant={status === 'connecting' ? 'secondary' : 'primary'}
                onPress={handleStartScan}
                isLoading={status === 'connecting'}
              />
              <TouchableOpacity
                onPress={onSkip}
                className="mt-4 flex-row items-center justify-center py-2 active:opacity-50">
                <Text className="mr-1 font-medium text-gray-400">건너뛰기</Text>
                <ChevronRight size={16} color="#D1D5DB" />
              </TouchableOpacity>
            </>
          ) : (
            <Button label="다음" variant="primary" onPress={onNext} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
