import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <StatusBar style="auto" />

      <Text className="mb-2 text-3xl font-bold text-blue-600">HealthCare AI</Text>
      <Text className="mb-10 text-center text-base text-gray-500">
        다치지 않고 확실하게, 나만의 AI 트레이너
      </Text>

      {/* 추후 /login 경로를 만들고 이동할 버튼 */}
      <TouchableOpacity
        className="rounded-full bg-blue-600 px-8 py-4"
        onPress={() => console.log('로그인 화면으로 이동')}>
        <Text className="text-lg font-bold text-white">시작하기</Text>
      </TouchableOpacity>
    </View>
  );
}
