import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/src/shared/ui/Button';

export default function LoginScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1">
        <View className="px-6 py-4">
          <TouchableOpacity onPress={() => router.back()} className="-ml-2 mb-4 p-2">
            <Text className="text-lg text-gray-800">←</Text>
          </TouchableOpacity>
          <Text className="mb-2 text-3xl font-bold text-gray-900">이메일 로그인</Text>
          <Text className="mb-8 text-base text-gray-500">
            가입하신 이메일과 비밀번호를 입력해주세요.
          </Text>
        </View>

        <View className="flex-1 px-6">
          <View className="mb-6">
            <Text className="mb-2 text-sm font-bold text-gray-700">이메일</Text>
            <TextInput
              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-base"
              placeholder="example@toss.im"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View className="mb-8">
            <Text className="mb-2 text-sm font-bold text-gray-700">비밀번호</Text>
            <TextInput
              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-base"
              placeholder="비밀번호를 입력해주세요"
              secureTextEntry
            />
          </View>

          <Button
            label="로그인"
            variant="primary"
            onPress={() => {
              // 추후 실제 로그인 로직(Supabase Auth)이 들어갈 자리.
              console.log('로그인 시도');
              // 로그인 성공 시 메인 대시보드나 온보딩으로
              router.push('/onboarding');
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
