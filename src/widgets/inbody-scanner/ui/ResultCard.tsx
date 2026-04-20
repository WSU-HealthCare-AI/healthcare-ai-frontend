import React from 'react';
import { View, Text } from 'react-native';
import { ConfidenceBar } from './ConfidenceBar';
import type { InbodyRecord, SegmentalLean } from '@/src/entities/inbody/model/types';

interface Props {
  result: Partial<InbodyRecord>;
  confidence: Record<string, number>;
  isFinal: boolean;
}

const BODY_COMPOSITION = [
  ['total_body_water_L', '체수분 (L)'],
  ['protein_kg', '단백질 (kg)'],
  ['minerals_kg', '무기질 (kg)'],
  ['body_fat_mass_kg', '체지방량 (kg)'],
] as const;

const MUSCLE_FAT = [
  ['weight_kg', '체중 (kg)'],
  ['skeletal_muscle_mass_kg', '골격근량 (kg)'],
] as const;

const OBESITY = [
  ['bmi', 'BMI'],
  ['body_fat_percentage', '체지방률 (%)'],
] as const;

const SEGMENTAL_PARTS = [
  ['right_arm', '오른팔'],
  ['left_arm', '왼팔'],
  ['trunk', '몸통'],
  ['right_leg', '오른다리'],
  ['left_leg', '왼다리'],
] as const;

function DataRow({
  label,
  value,
  conf,
  showConfidence = true,
}: {
  label: string;
  value: unknown;
  conf: number;
  showConfidence?: boolean;
}) {
  const hasValue = value !== null && value !== undefined && value !== '';

  return (
    <View className="flex-row items-center border-b border-zinc-100 py-2">
      <Text className="w-28 text-xs text-zinc-500">{label}</Text>

      <Text
        className={`w-16 text-right text-sm font-semibold ${
          hasValue ? 'text-zinc-900' : 'text-zinc-400'
        }`}>
        {hasValue ? String(value) : '-'}
      </Text>

      {showConfidence && <ConfidenceBar confidence={hasValue ? conf : 0} />}
    </View>
  );
}

function Section({
  title,
  fields,
  data,
  confidence,
  showConfidence = true,
}: {
  title: string;
  fields: ReadonlyArray<readonly [string, string]>;
  data: Partial<InbodyRecord>;
  confidence: Record<string, number>;
  showConfidence?: boolean;
}) {
  return (
    <View className="mt-4">
      <Text className="mb-1 text-[11px] font-bold uppercase tracking-widest text-zinc-400">
        {title}
      </Text>

      {fields.map(([key, label]) => (
        <DataRow
          key={key}
          label={label}
          value={data[key as keyof InbodyRecord]}
          conf={confidence[key] ?? 0}
          showConfidence={showConfidence}
        />
      ))}
    </View>
  );
}

function SegmentalSection({
  data,
  confidence,
  showConfidence = true,
}: {
  data: SegmentalLean | null | undefined;
  confidence: Record<string, number>;
  showConfidence?: boolean;
}) {
  return (
    <View className="mt-4">
      <Text className="mb-1 text-[11px] font-bold uppercase tracking-widest text-zinc-400">
        부위별 근육분석
      </Text>

      {SEGMENTAL_PARTS.map(([key, label]) => (
        <DataRow
          key={key}
          label={label}
          value={data?.[key as keyof SegmentalLean]}
          conf={confidence[`segmental_lean.${key}`] ?? 0}
          showConfidence={showConfidence}
        />
      ))}
    </View>
  );
}

export function ResultCard({ result, confidence, isFinal }: Props) {
  const showConfidence = true;

  return (
    <View
      className={`rounded-3xl bg-white p-5 shadow-sm ${
        isFinal ? 'border-2 border-emerald-500' : 'border border-zinc-100'
      }`}>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-lg font-bold text-zinc-900">
          {isFinal ? '스캔 완료' : '실시간 분석 중'}
        </Text>

        <View className={`rounded-full px-2.5 py-1 ${isFinal ? 'bg-emerald-100' : 'bg-blue-100'}`}>
          <Text
            className={`text-[11px] font-bold ${isFinal ? 'text-emerald-700' : 'text-blue-700'}`}>
            {isFinal ? 'FINAL' : 'LIVE'}
          </Text>
        </View>
      </View>

      <Section
        title="체성분분석"
        fields={BODY_COMPOSITION}
        data={result}
        confidence={confidence}
        showConfidence={showConfidence}
      />

      <Section
        title="골격근·지방분석"
        fields={MUSCLE_FAT}
        data={result}
        confidence={confidence}
        showConfidence={showConfidence}
      />

      <Section
        title="비만분석"
        fields={OBESITY}
        data={result}
        confidence={confidence}
        showConfidence={showConfidence}
      />

      <SegmentalSection
        data={result.segmental_lean}
        confidence={confidence}
        showConfidence={showConfidence}
      />
    </View>
  );
}
