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

export default function RegisterScreen() {
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
          <Text className="mb-2 text-3xl font-bold text-gray-900">회원가입</Text>
          <Text className="mb-8 text-base text-gray-500">이메일로 간편하게 시작해보세요.</Text>
        </View>

        <View className="flex-1 px-6">
          <View className="mb-6">
            <Text className="mb-2 text-sm font-bold text-gray-700">이메일</Text>
            <TextInput
              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-base"
              placeholder="example@test.abc"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-sm font-bold text-gray-700">비밀번호</Text>
            <TextInput
              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-base"
              placeholder="8자리 이상 영문, 숫자 조합"
              secureTextEntry
            />
          </View>

          <View className="mb-8">
            <Text className="mb-2 text-sm font-bold text-gray-700">비밀번호 확인</Text>
            <TextInput
              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-base"
              placeholder="비밀번호를 다시 입력해주세요"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            className="w-full items-center rounded-2xl bg-blue-600 py-4"
            onPress={() => router.push('/onboarding')}>
            <Text className="text-lg font-bold text-white">가입 완료 및 시작하기</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
