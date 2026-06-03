import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { MessageSquare } from 'lucide-react-native';

export interface FeedbackFormProps {
  fatigue: number;
  setFatigue: (lvl: number) => void;
  pain: number;
  setPain: (lvl: number) => void;
  notes: string;
  setNotes: (text: string) => void;
  saveFeedback: () => void;
  isPending: boolean;
}

export function FeedbackForm({
  fatigue,
  setFatigue,
  pain,
  setPain,
  notes,
  setNotes,
  saveFeedback,
  isPending,
}: FeedbackFormProps) {
  return (
    <View className="mb-6 rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <View className="mb-4 flex-row items-center">
        <MessageSquare size={18} color="#4B5563" />
        <Text className="ml-2 text-base font-bold text-gray-800">오늘의 플랜 종합 평가</Text>
      </View>

      {/* 1. 운동 난이도 조절 양식 개편 */}
      <View className="mb-5">
        <Text className="mb-2.5 text-sm font-semibold text-gray-700">
          오늘 운동 난이도는 어땠나요?
        </Text>
        <View className="flex-row justify-between">
          {[1, 2, 3, 4, 5].map((lvl) => {
            const labels: Record<number, string> = {
              1: '매우 쉬움',
              2: '쉬움',
              3: '적당함',
              4: '어려움',
              5: '매우 어려움',
            };
            return (
              <TouchableOpacity
                key={lvl}
                onPress={() => setFatigue(lvl)}
                className="w-[18%] items-center justify-center rounded-xl border py-2.5"
                style={{
                  backgroundColor: fatigue === lvl ? '#2563EB' : '#FFFFFF',
                  borderColor: fatigue === lvl ? '#2563EB' : '#E5E7EB',
                }}>
                <Text
                  className="text-xs font-bold"
                  style={{ color: fatigue === lvl ? '#FFFFFF' : '#4B5563' }}>
                  {lvl}
                </Text>
                <Text
                  className="mt-0.5 text-[8px]"
                  style={{ color: fatigue === lvl ? '#E0F2FE' : '#9CA3AF', fontWeight: '500' }}>
                  {labels[lvl]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 2. 신체 컨디션 양식 개편 */}
      <View className="mb-5">
        <Text className="mb-2.5 text-sm font-semibold text-gray-700">
          오늘 전반적인 신체 컨디션은 어떤가요?
        </Text>
        <View className="flex-row justify-between">
          {[1, 2, 3, 4, 5].map((lvl) => {
            const labels: Record<number, string> = {
              1: '매우 나쁨',
              2: '나쁨',
              3: '보통',
              4: '좋음',
              5: '매우 좋음',
            };
            return (
              <TouchableOpacity
                key={lvl}
                onPress={() => setPain(lvl)}
                className="w-[18%] items-center justify-center rounded-xl border py-2.5"
                style={{
                  backgroundColor: pain === lvl ? '#10B981' : '#FFFFFF',
                  borderColor: pain === lvl ? '#10B981' : '#E5E7EB',
                }}>
                <Text
                  className="text-xs font-bold"
                  style={{ color: pain === lvl ? '#FFFFFF' : '#4B5563' }}>
                  {lvl}
                </Text>
                <Text
                  className="mt-0.5 text-[8px]"
                  style={{ color: pain === lvl ? '#D1FAE5' : '#9CA3AF', fontWeight: '500' }}>
                  {labels[lvl]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 3. 메모 및 한줄평 */}
      <View className="mb-4">
        <Text className="mb-2 text-sm font-semibold text-gray-700">
          오늘 플랜에 대한 만족도 및 피드백 한줄 메모
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholderTextColor="#9CA3AF"
          placeholder="식단 구성이 만족스러웠고, 월 푸쉬업 동작 시 무리 없이 편안했습니다."
          className="rounded-xl border border-gray-200 bg-white p-3.5 text-sm text-gray-800"
          multiline
          numberOfLines={3}
        />
      </View>

      <TouchableOpacity
        onPress={saveFeedback}
        disabled={isPending}
        className="items-center rounded-xl bg-blue-600 py-3.5">
        <Text className="text-sm font-bold text-white">기록 저장 및 AI 맞춤 분석 받기</Text>
      </TouchableOpacity>
    </View>
  );
}
