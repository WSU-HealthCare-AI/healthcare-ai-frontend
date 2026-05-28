import React, { useRef } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { Brain } from 'lucide-react-native';

export function AiFeedbackCard({ feedback }: { feedback: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [pulse, fadeAnim]);

  return (
    <Animated.View
      style={{ opacity: fadeAnim }}
      className="mb-2 flex-row rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
      <Brain size={24} color="#4F46E5" />
      <View className="ml-3 flex-1">
        <View className="flex-row items-center">
          <Text className="text-sm font-bold text-indigo-900">AI 피드백</Text>
        </View>
        <Text className="mt-1 text-xs leading-5 text-indigo-700">{feedback}</Text>
      </View>
    </Animated.View>
  );
}
