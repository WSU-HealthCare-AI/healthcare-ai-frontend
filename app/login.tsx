import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Mail, Lock, ArrowLeft } from 'lucide-react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/src/shared/ui/Button';

// 로그인 유효성 검사 스키마 정의
const loginSchema = z.object({
  email: z.string().email('올바른 이메일 형식을 입력해주세요.'),
  password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const router = useRouter();

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onChange',
  });

  const onSubmit = (data: LoginFormValues) => {
    console.log('Login Data:', data);
    router.replace('/(main)');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          className="px-6"
          keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            onPress={() => router.back()}
            className="-ml-2 mt-4 h-10 w-10 items-center justify-center">
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>

          <View className="mb-10 mt-8">
            <Text className="text-3xl font-bold text-gray-900">반가워요!</Text>
            <Text className="mt-2 text-lg text-gray-500">이메일로 로그인을 진행해 주세요.</Text>
          </View>

          <View className="space-y-6">
            {/* 이메일 입력 */}
            <View>
              <Text className="mb-2 ml-1 text-sm font-bold text-gray-700">이메일</Text>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View
                    className={`flex-row items-center border bg-gray-50 ${errors.email ? 'border-red-500' : 'border-gray-100'} h-16 rounded-2xl px-4`}>
                    <Mail size={20} color={errors.email ? '#EF4444' : '#9CA3AF'} />
                    <TextInput
                      className="ml-3 flex-1 text-base"
                      placeholder="example@email.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                    />
                  </View>
                )}
              />
              {errors.email && (
                <Text className="ml-1 mt-1 text-xs text-red-500">{errors.email.message}</Text>
              )}
            </View>

            {/* 비밀번호 입력 */}
            <View className="mt-4">
              <Text className="mb-2 ml-1 text-sm font-bold text-gray-700">비밀번호</Text>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View
                    className={`flex-row items-center border bg-gray-50 ${errors.password ? 'border-red-500' : 'border-gray-100'} h-16 rounded-2xl px-4`}>
                    <Lock size={20} color={errors.password ? '#EF4444' : '#9CA3AF'} />
                    <TextInput
                      className="ml-3 flex-1 text-base"
                      placeholder="비밀번호를 입력하세요"
                      secureTextEntry
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                    />
                  </View>
                )}
              />
              {errors.password && (
                <Text className="ml-1 mt-1 text-xs text-red-500">{errors.password.message}</Text>
              )}
            </View>
          </View>

          <TouchableOpacity className="mt-4 self-end">
            <Text className="font-medium text-blue-600">비밀번호를 잊으셨나요?</Text>
          </TouchableOpacity>

          <View className="mb-8 mt-auto">
            <Button
              label="로그인"
              variant={isValid ? 'primary' : 'secondary'}
              onPress={handleSubmit(onSubmit)}
              disabled={!isValid}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
