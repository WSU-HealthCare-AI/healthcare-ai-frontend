import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  ONBOARDING_DATA,
  onboardingSchema,
  OnboardingFormValues,
} from '@/src/entities/user/model/onboarding';
import { Chip } from '@/src/shared/ui/Chip';
import { Button } from '@/src/shared/ui/Button';
import { OnboardingHeader } from '@/src/widgets/header/ui/OnboardingHeader';
import { useRegistrationStore } from '@/src/entities/user/model/store';
import { useAuthStore } from '@/src/entities/user/model/authStore';

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Zustand 전역 스토어 연결
  const { setProfile } = useRegistrationStore();
  const { session } = useAuthStore();

  // 가입 경로(이메일/구글)에 따른 스텝 수 계산
  const isGoogle = session?.user?.app_metadata?.provider === 'google';
  const currentStep = isGoogle ? 1 : 2;
  const totalSteps = isGoogle ? 3 : 4;

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: '',
      birthDate: '',
      gender: '',
      height: '',
      weight: '',
      purposes: [],
      painPoints: ['없음'],
      diseases: ['없음'],
      allergies: '',
      surgeryHistory: '',
    },
    mode: 'onChange',
  });

  const formValues = watch();

  // 네이티브 키보드 대응 및 안드로이드 제스처 뒤로가기 포커스 해제
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
      Keyboard.dismiss();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleToggleArray = (field: keyof OnboardingFormValues, value: string) => {
    const currentArray = (formValues[field] as string[]) || [];

    // '없음'을 누른 경우 다른 모든 선택을 지우고 '없음'만 남김
    if (value === '없음') {
      setValue(field, ['없음'] as any, { shouldValidate: true });
      return;
    }

    // '없음'이 아닌 다른 항목을 누른 경우
    const filtered = currentArray.filter((i) => i !== '없음');
    const nextArray = filtered.includes(value)
      ? filtered.filter((i) => i !== value)
      : [...filtered, value];

    // 만약 모든 선택을 해제했다면 자동으로 '없음' 선택
    const finalArray = nextArray.length === 0 ? ['없음'] : nextArray;

    setValue(field, finalArray as any, { shouldValidate: true });
  };

  const onNext = (data: OnboardingFormValues) => {
    // Zustand 스토어에 데이터 반영
    setProfile(data);
    // 다음 단계(인바디 등록)로 이동
    router.push('/onboarding/inbody');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <OnboardingHeader currentStep={currentStep} totalSteps={totalSteps} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <ScrollView
          ref={scrollViewRef}
          className="flex-1 px-6 pt-4"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: isKeyboardVisible ? 280 : 40 }}>
          <Text className="mb-8 text-2xl font-bold leading-tight text-gray-900">
            정확한 추천을 위해{'\n'}기본 정보를 알려주세요.
          </Text>

          {/* 이름 입력 */}
          <View className="mb-6">
            <Text className="mb-2 ml-1 text-sm font-bold text-gray-700">이름</Text>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className={`w-full rounded-xl border bg-gray-50 p-4 text-base text-gray-900 ${errors.name ? 'border-red-500' : 'border-gray-100'}`}
                  placeholder="별명으로 사용될 이름을 입력해주세요"
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
            {errors.name && (
              <Text className="ml-1 mt-1 text-xs text-red-500">{errors.name.message}</Text>
            )}
          </View>

          {/* 생년월일 입력 */}
          <View className="mb-8">
            <Text className="mb-2 ml-1 text-sm font-bold text-gray-700">생년월일 (8자리)</Text>
            <Controller
              control={control}
              name="birthDate"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className={`w-full rounded-xl border bg-gray-50 p-4 text-base text-gray-900 ${errors.birthDate ? 'border-red-500' : 'border-gray-100'}`}
                  placeholder="예: 19900101"
                  keyboardType="numeric"
                  maxLength={8}
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
            {errors.birthDate && (
              <Text className="ml-1 mt-1 text-xs text-red-500">{errors.birthDate.message}</Text>
            )}
          </View>

          {/* 성별 선택 섹션 */}
          <View className="mb-8">
            <Text className="mb-3 text-sm font-bold text-gray-700">성별</Text>
            <View className="flex-row flex-wrap">
              {ONBOARDING_DATA.GENDERS.map((g) => (
                <Chip
                  key={g}
                  label={g}
                  isSelected={formValues.gender === g}
                  onPress={() => setValue('gender', g, { shouldValidate: true })}
                />
              ))}
            </View>
            {errors.gender && (
              <Text className="mt-1 text-xs text-red-500">{errors.gender.message}</Text>
            )}
          </View>

          {/* 키와 몸무게 입력 섹션 */}
          <View className="mb-8 flex-row space-x-4">
            <View className="mr-2 flex-1">
              <Text className="mb-2 text-sm font-bold text-gray-700">키 (cm)</Text>
              <Controller
                control={control}
                name="height"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    className={`w-full rounded-xl border bg-gray-50 p-4 text-base text-gray-900 ${errors.height ? 'border-red-500' : 'border-gray-100'}`}
                    placeholder="170"
                    keyboardType="numeric"
                    value={value}
                    onChangeText={onChange}
                  />
                )}
              />
            </View>
            <View className="ml-2 flex-1">
              <Text className="mb-2 text-sm font-bold text-gray-700">몸무게 (kg)</Text>
              <Controller
                control={control}
                name="weight"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    className={`w-full rounded-xl border bg-gray-50 p-4 text-base text-gray-900 ${errors.weight ? 'border-red-500' : 'border-gray-100'}`}
                    placeholder="70"
                    keyboardType="numeric"
                    value={value}
                    onChangeText={onChange}
                  />
                )}
              />
            </View>
          </View>

          {/* 운동 목적 선택 */}
          <View className="mb-8">
            <Text className="mb-3 text-sm font-bold text-gray-700">운동 목적 (중복 가능)</Text>
            <View className="flex-row flex-wrap">
              {ONBOARDING_DATA.PURPOSES.map((p) => (
                <Chip
                  key={p}
                  label={p}
                  isSelected={formValues.purposes.includes(p)}
                  onPress={() => handleToggleArray('purposes', p)}
                />
              ))}
            </View>
          </View>

          {/* 통증 부위 선택  */}
          <View className="mb-8">
            <Text className="mb-3 text-sm font-bold text-gray-700">통증 부위 (중복 가능)</Text>
            <View className="flex-row flex-wrap">
              {ONBOARDING_DATA.PAIN_POINTS.map((p) => (
                <Chip
                  key={p}
                  label={p}
                  isSelected={formValues.painPoints.includes(p)}
                  onPress={() => handleToggleArray('painPoints', p)}
                />
              ))}
            </View>
          </View>

          {/* 기저 질환 선택  */}
          <View className="mb-8">
            <Text className="mb-3 text-sm font-bold text-gray-700">기저 질환 (중복 가능)</Text>
            <View className="flex-row flex-wrap">
              {ONBOARDING_DATA.DISEASES.map((d) => (
                <Chip
                  key={d}
                  label={d}
                  isSelected={formValues.diseases.includes(d)}
                  onPress={() => handleToggleArray('diseases', d)}
                />
              ))}
            </View>
          </View>

          {/* 알러지 정보 입력 */}
          <View className="mb-8">
            <Text className="mb-3 text-sm font-bold text-gray-700">알러지 정보 (식단 추천용)</Text>
            <Controller
              control={control}
              name="allergies"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className="w-full rounded-xl border border-gray-100 bg-gray-50 p-4 text-base text-gray-900"
                  placeholder="예: 땅콩, 갑각류, 복숭아 등 (없으면 비워두세요)"
                  value={value}
                  onChangeText={onChange}
                  onFocus={() =>
                    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150)
                  }
                />
              )}
            />
          </View>

          {/* 과거 수술 이력 및 추가 정보 */}
          <View className="mb-8">
            <Text className="mb-3 text-sm font-bold text-gray-700">
              과거 수술 이력 및 복용 약물
            </Text>
            <Controller
              control={control}
              name="surgeryHistory"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className="h-24 w-full rounded-xl border border-gray-100 bg-gray-50 p-4 text-base text-gray-900"
                  placeholder="예: 3년 전 허리 디스크 수술 등"
                  multiline
                  textAlignVertical="top"
                  value={value}
                  onChangeText={onChange}
                  onFocus={() => {
                    // 키보드에 가려지지 않게 스크롤 끝까지 이동
                    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150);
                  }}
                />
              )}
            />
          </View>
        </ScrollView>

        <View className="border-t border-gray-100 bg-white px-6 py-4">
          <Button
            label="다음으로"
            variant={isValid ? 'primary' : 'secondary'}
            onPress={handleSubmit(onNext)}
            disabled={!isValid}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
