import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Lock, ShieldCheck } from 'lucide-react-native';
import * as z from 'zod';

import { Button } from '@/src/shared/ui/Button';
import { OnboardingHeader } from '@/src/widgets/header/ui/OnboardingHeader';
import { useRegistrationStore } from '@/src/entities/user/model/store';
import { supabase } from '@/src/shared/api/supabase';

// 회원가입 유효성 검사 스키마 정의
const registerSchema = z
  .object({
    email: z.string().email('올바른 이메일 형식을 입력해주세요.'),
    password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다.'),
    confirmPassword: z.string().min(1, '비밀번호 확인을 입력해주세요.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다.',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const router = useRouter();
  const setAccount = useRegistrationStore((state) => state.setAccount);
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  });

  // 다음 단계(온보딩 질문)로 이동
  const onNext = async (data: RegisterFormValues) => {
    setIsLoading(true);

    // Supabase Auth 회원가입 호출
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });

    setIsLoading(false);

    if (error) {
      Alert.alert('회원가입 실패', error.message);
      return;
    }

    // Zustand 스토어에 계정 정보 저장
    setAccount({
      email: data.email,
      authProvider: 'email',
    });

    // 온보딩으로 이동
    router.push('/onboarding');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* 이메일 가입 시 총 4단계 중 1단계로 표시 */}
      <OnboardingHeader currentStep={1} totalSteps={4} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1">
        <ScrollView
          className="px-6"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View className="mb-10 mt-8">
            <Text className="mb-2 text-3xl font-bold text-gray-900">계정 만들기</Text>
            <Text className="text-lg text-gray-500">먼저 사용할 계정 정보를 입력해주세요.</Text>
          </View>

          <View className="space-y-5">
            {/* 이메일 필드 */}
            <View>
              <Text className="mb-2 ml-1 text-sm font-bold text-gray-700">이메일</Text>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value } }) => (
                  <View
                    className={`flex-row items-center border bg-gray-50 ${errors.email ? 'border-red-500' : 'border-gray-100'} h-16 rounded-2xl px-4`}>
                    <Mail size={20} color={errors.email ? '#EF4444' : '#9CA3AF'} />
                    <TextInput
                      className="ml-3 flex-1 text-base text-gray-900"
                      placeholder="example@email.com"
                      value={value}
                      onChangeText={onChange}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                )}
              />
              {errors.email && (
                <Text className="ml-1 mt-1 text-xs text-red-500">{errors.email.message}</Text>
              )}
            </View>

            {/* 비밀번호 필드 */}
            <View className="mt-4">
              <Text className="mb-2 ml-1 text-sm font-bold text-gray-700">비밀번호</Text>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value } }) => (
                  <View
                    className={`flex-row items-center border bg-gray-50 ${errors.password ? 'border-red-500' : 'border-gray-100'} h-16 rounded-2xl px-4`}>
                    <Lock size={20} color={errors.password ? '#EF4444' : '#9CA3AF'} />
                    <TextInput
                      className="ml-3 flex-1 text-base text-gray-900"
                      placeholder="최소 6자 이상"
                      secureTextEntry
                      value={value}
                      onChangeText={onChange}
                    />
                  </View>
                )}
              />
              {errors.password && (
                <Text className="ml-1 mt-1 text-xs text-red-500">{errors.password.message}</Text>
              )}
            </View>

            {/* 비밀번호 확인 필드 */}
            <View className="mt-4">
              <Text className="mb-2 ml-1 text-sm font-bold text-gray-700">비밀번호 확인</Text>
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, value } }) => (
                  <View
                    className={`flex-row items-center border bg-gray-50 ${errors.confirmPassword ? 'border-red-500' : 'border-gray-100'} h-16 rounded-2xl px-4`}>
                    <ShieldCheck size={20} color={errors.confirmPassword ? '#EF4444' : '#9CA3AF'} />
                    <TextInput
                      className="ml-3 flex-1 text-base text-gray-900"
                      placeholder="다시 한번 입력"
                      secureTextEntry
                      value={value}
                      onChangeText={onChange}
                    />
                  </View>
                )}
              />
              {errors.confirmPassword && (
                <Text className="ml-1 mt-1 text-xs text-red-500">
                  {errors.confirmPassword.message}
                </Text>
              )}
            </View>
          </View>

          <View className="mb-10 mt-auto pt-10">
            <Button
              label="다음으로"
              variant={isValid ? 'primary' : 'secondary'}
              onPress={handleSubmit(onNext)}
              disabled={!isValid}
              isLoading={isLoading}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
