import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Button } from '@/src/shared/ui/Button';
import { useRegistrationStore } from '@/src/entities/user/model/store';

export default function WelcomeScreen() {
  const router = useRouter();
  const { setAccount, reset } = useRegistrationStore();

  const handleGoogleStart = () => {
    reset();
    // 실제 구글 연동 전 임시 데이터 세팅
    setAccount({ email: 'google-user@gmail.com', authProvider: 'google' });
    router.push('/onboarding'); // 구글은 계정 생성을 건너뛰고 바로 온보딩으로
  };

  const handleRegisterStart = () => {
    reset();
    router.push('/register');
  };

  return (
    <View className="flex-1 bg-white px-6">
      <StatusBar style="dark" />
      <View className="flex-1 items-start justify-center">
        <View className="mb-6">
          <Text className="text-6xl font-bold text-blue-600">FitMate AI</Text>
        </View>

        <Text className="mb-4 text-left text-3xl font-bold leading-tight text-gray-900">
          다치지 않고 건강하게,{'\n'}나만의 AI 트레이너
        </Text>

        <Text className="text-left text-base leading-relaxed text-gray-500">
          맞춤형 건강 플랜부터 실시간 자세 교정까지{'\n'}지금 바로 시작하세요.
        </Text>
      </View>

      <View className="pb-20">
        <Button label="구글로 시작하기" variant="secondary" onPress={handleGoogleStart} />

        <View className="my-4 flex-row items-center">
          <View className="h-[1px] flex-1 bg-gray-200" />
          <Text className="mx-4 text-sm text-gray-400">또는</Text>
          <View className="h-[1px] flex-1 bg-gray-200" />
        </View>

        <Button
          label="이메일로 로그인하기"
          variant="outline"
          onPress={() => router.push('/login')}
        />

        <View className="mt-6 flex-row justify-center">
          <Text className="text-sm text-gray-500">아직 회원이 아니신가요? </Text>
          <TouchableOpacity onPress={handleRegisterStart}>
            <Text className="text-sm font-bold text-blue-600">가입하기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
