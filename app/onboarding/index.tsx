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
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'expo-router';

import { ONBOARDING_DATA } from '@/src/entities/user/model/onboarding';
import { Chip } from '@/src/shared/ui/Chip';
import { Button } from '@/src/shared/ui/Button';
import { OnboardingHeader } from '@/src/widgets/header/ui/OnboardingHeader';

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  const [gender, setGender] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [purposes, setPurposes] = useState<string[]>([]);
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [diseases, setDiseases] = useState<string[]>([]);
  const [surgeryHistory, setSurgeryHistory] = useState<string>('');

  const [isKeyboardVisible, setIsKeyboardVisible] = useState<boolean>(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () =>
      setIsKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
      Keyboard.dismiss();
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const toggleSelection = (
    item: string,
    currentList: string[],
    setList: (list: string[]) => void
  ) => {
    if (item === '없음') {
      setList(['없음']);
      return;
    }
    let newList = currentList.filter((i) => i !== '없음');
    if (newList.includes(item)) {
      setList(newList.filter((i) => i !== item));
    } else {
      setList([...newList, item]);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <OnboardingHeader currentStep={1} totalSteps={3} />

        <ScrollView
          ref={scrollViewRef}
          className="flex-1 px-6 pt-4"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: isKeyboardVisible ? 250 : 40 }}>
          <Text className="mb-8 text-2xl font-bold leading-tight text-gray-900">
            정확한 맞춤 추천을 위해{'\n'}몇 가지 정보가 필요해요.
          </Text>

          <View className="mb-8">
            <Text className="mb-3 text-sm font-bold text-gray-700">성별</Text>
            <View className="mb-4 flex-row flex-wrap">
              {ONBOARDING_DATA.GENDERS.map((g: string) => (
                <Chip key={g} label={g} isSelected={gender === g} onPress={() => setGender(g)} />
              ))}
            </View>

            <View className="flex-row space-x-4">
              <View className="mr-2 flex-1">
                <Text className="mb-2 text-sm font-bold text-gray-700">키 (cm)</Text>
                <TextInput
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-base"
                  placeholder="170"
                  keyboardType="numeric"
                  value={height}
                  onChangeText={setHeight}
                />
              </View>
              <View className="ml-2 flex-1">
                <Text className="mb-2 text-sm font-bold text-gray-700">몸무게 (kg)</Text>
                <TextInput
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-base"
                  placeholder="70"
                  keyboardType="numeric"
                  value={weight}
                  onChangeText={setWeight}
                />
              </View>
            </View>
          </View>

          <View className="mb-8">
            <Text className="mb-3 text-sm font-bold text-gray-700">운동 목적 (중복 선택 가능)</Text>
            <View className="flex-row flex-wrap">
              {ONBOARDING_DATA.PURPOSES.map((p: string) => (
                <Chip
                  key={p}
                  label={p}
                  isSelected={purposes.includes(p)}
                  onPress={() => toggleSelection(p, purposes, setPurposes)}
                />
              ))}
            </View>
          </View>

          <View className="mb-8">
            <Text className="mb-3 text-sm font-bold text-gray-700">
              현재 통증 부위 (중복 선택 가능)
            </Text>
            <View className="flex-row flex-wrap">
              {ONBOARDING_DATA.PAIN_POINTS.map((p: string) => (
                <Chip
                  key={p}
                  label={p}
                  isSelected={painPoints.includes(p)}
                  onPress={() => toggleSelection(p, painPoints, setPainPoints)}
                />
              ))}
            </View>
          </View>

          <View className="mb-8">
            <Text className="mb-3 text-sm font-bold text-gray-700">기저 질환 (중복 선택 가능)</Text>
            <View className="flex-row flex-wrap">
              {ONBOARDING_DATA.DISEASES.map((d: string) => (
                <Chip
                  key={d}
                  label={d}
                  isSelected={diseases.includes(d)}
                  onPress={() => toggleSelection(d, diseases, setDiseases)}
                />
              ))}
            </View>
          </View>

          <View className="mb-8">
            <Text className="mb-3 text-sm font-bold text-gray-700">
              과거 수술 이력 및 복용 약물
            </Text>
            <TextInput
              className="h-24 w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-base text-gray-800"
              placeholder="예: 3년 전 허리 디스크 수술, 혈압약 복용 중"
              multiline
              textAlignVertical="top"
              value={surgeryHistory}
              onChangeText={setSurgeryHistory}
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: false });
                }, 200);
              }}
            />
          </View>
        </ScrollView>

        <View className="border-t border-gray-100 bg-white px-6 py-4">
          <Button
            label="다음으로"
            variant="primary"
            onPress={() => {
              Keyboard.dismiss();
              console.log('다음 단계로 이동 완료');
              // router.push('/onboarding/step2');
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
