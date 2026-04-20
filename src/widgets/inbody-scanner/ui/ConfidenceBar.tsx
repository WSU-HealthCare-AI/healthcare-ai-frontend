import React from 'react';
import { View } from 'react-native';

interface Props {
  confidence: number;
}

export function ConfidenceBar({ confidence }: Props) {
  const safeConfidence = Math.max(0, Math.min(1, Number.isFinite(confidence) ? confidence : 0));

  const barColor =
    safeConfidence >= 0.8
      ? 'bg-emerald-500'
      : safeConfidence >= 0.5
        ? 'bg-amber-500'
        : 'bg-red-500';

  const widthPercent = Math.max(safeConfidence * 100, 8);

  return (
    <View className="ml-2 h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200">
      <View
        className={`h-full rounded-full ${barColor}`}
        style={{ width: `${widthPercent}%`, opacity: safeConfidence > 0 ? 1 : 0.2 }}
      />
    </View>
  );
}
