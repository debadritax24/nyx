import { Stack } from 'expo-router';
import { useTheme } from '../../src/store/themeStore';

export default function AppLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
      <Stack.Screen name="add-manual" options={{ presentation: 'modal' }} />
      <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
      <Stack.Screen name="devices" options={{ presentation: 'modal' }} />
      <Stack.Screen name="enrollment" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
