import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../global.css';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        {/* index.tsx가 '/' 경로로 자동 렌더링 됨. */}
        <Stack.Screen name="index" />
      </Stack>
    </SafeAreaProvider>
  );
}
