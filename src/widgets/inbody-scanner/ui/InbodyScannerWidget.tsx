import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { useInbodyScanner } from '@/src/features/inbody-scan/model/useInbodyScanner';
import { ScannerCamera } from './ScannerCamera';
import { ScanOverlay } from './ScanOverlay';

interface Props {
  onScanComplete?: (result: any) => void;
  onCancel?: () => void;
}

// 데이터 섹션 정의
const SECTIONS = {
  COMPOSITION: [
    ['total_body_water_L', '체수분 (L)'],
    ['protein_kg', '단백질 (kg)'],
    ['minerals_kg', '무기질 (kg)'],
    ['body_fat_mass_kg', '체지방량 (kg)'],
  ],
  MUSCLE_FAT: [
    ['weight_kg', '체중 (kg)'],
    ['skeletal_muscle_mass_kg', '골격근량 (kg)'],
  ],
  OBESITY: [
    ['bmi', 'BMI'],
    ['body_fat_percentage', '체지방률 (%)'],
  ],
} as const;

export function InbodyScannerWidget({ onScanComplete, onCancel }: Props) {
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

  useEffect(() => {
    startSession();
  }, [startSession]);

  useEffect(() => {
    if (status === 'complete' && finalResult) {
      onScanComplete?.(finalResult);
    }
  }, [status, finalResult, onScanComplete]);

  // 렌더 헬퍼 컴포넌트
  const ConfidenceBar = ({ value }: { value: number }) => {
    const color = value >= 0.8 ? 'bg-green-500' : value >= 0.5 ? 'bg-orange-500' : 'bg-red-500';
    return (
      <View className="ml-3 h-1 flex-1 overflow-hidden rounded-full bg-zinc-700">
        <View className={`h-full ${color}`} style={{ width: `${value * 100}%` }} />
      </View>
    );
  };

  const DataRow = ({ label, value, conf }: { label: string; value: any; conf: number }) => (
    <View className="flex-row items-center border-b border-zinc-800/50 py-2">
      <Text className="w-24 text-xs text-zinc-400">{label}</Text>
      <Text
        className={`w-16 text-right text-sm font-bold ${value == null ? 'text-zinc-600' : 'text-white'}`}>
        {value != null ? String(value) : '-'}
      </Text>
      {value != null && <ConfidenceBar value={conf} />}
    </View>
  );

  return (
    <View className="flex-1 bg-black">
      {/* 상단 카메라 영역 */}
      <View className="relative flex-1">
        <ScannerCamera isScanning={status === 'scanning'} onFrame={sendFrame} />
        <ScanOverlay
          status={status}
          framesSent={framesSent}
          fieldsFound={fieldsFound}
          totalFields={8}
        />
      </View>

      {/* 하단 결과 카드 영역 */}
      <View className="min-h-[40%] rounded-t-[32px] bg-zinc-900 px-6 pb-10 pt-6 shadow-2xl">
        <View className="mb-4 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Text className="text-xl font-bold text-white">
              {status === 'complete' ? '분석 완료' : '실시간 분석 중'}
            </Text>
            {status === 'scanning' && (
              <View className="ml-3 flex-row items-center rounded-md bg-blue-500/10 px-2 py-1">
                <ActivityIndicator size="small" color="#3b82f6" />
                <Text className="ml-1 text-xs font-bold text-blue-500">AI 인식 중</Text>
              </View>
            )}
          </View>
          {status === 'complete' && <CheckCircle2 size={24} color="#22c55e" />}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="max-h-80">
          {/* 데이터 섹션들 */}
          <View className="space-y-4">
            {Object.entries(SECTIONS).map(([sectionKey, fields]) => (
              <View key={sectionKey} className="mb-2">
                <Text className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  {sectionKey === 'COMPOSITION'
                    ? '체성분'
                    : sectionKey === 'MUSCLE_FAT'
                      ? '골격근/지방'
                      : '비만 지표'}
                </Text>
                {fields.map(([key, label]) => (
                  <DataRow
                    key={key}
                    label={label}
                    value={status === 'complete' ? finalResult?.[key] : partialResult?.[key]}
                    conf={confidence[key] ?? 0}
                  />
                ))}
              </View>
            ))}
          </View>

          {/* 에러 상태 및 재시도 */}
          {status === 'error' && (
            <View className="items-center py-10">
              <Text className="mb-4 font-semibold text-red-400">연결에 문제가 발생했습니다.</Text>
              <TouchableOpacity
                onPress={startSession}
                className="rounded-2xl bg-zinc-800 px-8 py-3">
                <Text className="font-bold text-white">다시 연결하기</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* 하단 취소 버튼 */}
        {status === 'error' && onCancel && (
          <TouchableOpacity onPress={onCancel} className="mt-4 items-center">
            <Text className="font-medium text-zinc-500">온보딩 건너뛰기</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
