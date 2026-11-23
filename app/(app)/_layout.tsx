import { Stack } from 'expo-router';
import { Colors } from '../../src/components/tokens';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
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
