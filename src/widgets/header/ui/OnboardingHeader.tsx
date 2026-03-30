import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export interface OnboardingHeaderProps {
  currentStep: number;
  totalSteps: number;
}

export const OnboardingHeader = ({ currentStep, totalSteps }: OnboardingHeaderProps) => {
  const router = useRouter();
  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <View className="w-full flex-row items-center justify-between bg-white px-6 py-4">
      <TouchableOpacity onPress={() => router.back()} className="-ml-2 p-2">
        <Text className="text-xl font-bold text-gray-800">←</Text>
      </TouchableOpacity>

      <View className="relative mx-4 h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
        <View
          className="absolute bottom-0 left-0 top-0 rounded-full bg-blue-600"
          style={{ width: `${progressPercentage}%` }}
        />
      </View>

      <Text className="w-8 text-right font-bold text-blue-600">
        {currentStep}/{totalSteps}
      </Text>
    </View>
  );
};
