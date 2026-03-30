import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Button } from '@/src/shared/ui/Button';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-white px-6">
      <StatusBar style="dark" />

      {/* 히어로 섹션 */}
      <View className="flex-1 items-start justify-center">
        <View className="mb-6">
          <Text className="text-6xl font-bold text-blue-600">FitMate AI</Text>
        </View>

        <Text className="mb-4 text-left text-3xl font-bold leading-tight text-gray-900">
          다치지 않고 확실하게,{'\n'}나만의 AI 트레이너
        </Text>

        <Text className="text-left text-base leading-relaxed text-gray-500">
          인바디 분석부터 실시간 자세 교정까지{'\n'}지금 바로 시작하세요.
        </Text>
      </View>

      {/* 하단 버튼 섹션 */}
      <View className="pb-12">
        <Button
          label="구글로 시작하기"
          variant="secondary"
          onPress={() => router.push('/onboarding')}
        />

        <View className="my-4 flex-row items-center">
          <View className="h-[1px] flex-1 bg-gray-200" />
          <Text className="mx-4 text-sm text-gray-400">또는</Text>
          <View className="h-[1px] flex-1 bg-gray-200" />
        </View>

        <View className="mb-6">
          <Button
            label="이메일로 로그인하기"
            variant="primary"
            onPress={() => router.push('/login')}
          />
        </View>

        {/* 회원가입 */}
        <View className="flex-row justify-center">
          <Text className="text-sm text-gray-500">아직 회원이 아니신가요? </Text>
          <Text
            className="text-sm font-bold text-blue-600"
            onPress={() => router.push('/register')}>
            가입하기
          </Text>
        </View>
      </View>
    </View>
  );
}
