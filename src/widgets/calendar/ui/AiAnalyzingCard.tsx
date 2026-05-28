import React, { useRef } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { Brain } from 'lucide-react-native';

export function AiAnalyzingCard({ step }: { step: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnim.start();

    const rotateAnim = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotateAnim.start();

    return () => {
      pulseAnim.stop();
      rotateAnim.stop();
    };
  }, [pulse, rotation]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1.05],
  });

  const rotateInterpolate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View className="mb-8 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50/50 p-6">
      <View className="relative mb-4 items-center justify-center">
        {/* 뒤에서 빛나는 회전 링 */}
        <Animated.View
          style={{
            transform: [{ rotate: rotateInterpolate }],
            position: 'absolute',
            width: 70,
            height: 70,
            borderRadius: 35,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: '#6366F1',
            opacity: 0.4,
          }}
        />
        {/* 중앙 뇌 아이콘과 맥박 효과 */}
        <Animated.View
          style={{
            transform: [{ scale }],
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#EEF2FF',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Brain size={28} color="#4F46E5" />
        </Animated.View>
      </View>

      <Text className="mb-2 text-sm font-bold text-indigo-900">AI 코칭 시스템 분석 중</Text>

      {/* 진행 바 */}
      <View className="mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-indigo-100">
        <View
          className="h-full rounded-full bg-indigo-600"
          style={{
            width: step === 0 ? '33%' : step === 1 ? '66%' : '100%',
          }}
        />
      </View>
    </View>
  );
}
