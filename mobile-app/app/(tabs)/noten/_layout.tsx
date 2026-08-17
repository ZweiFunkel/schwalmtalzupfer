import { Stack } from 'expo-router';
import { colors, font } from '../../../lib/theme';

export default function NotenLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitleAlign: 'center',
        headerTitleStyle: { fontFamily: font.semiBold, fontSize: 17, color: colors.text },
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTintColor: colors.primary600,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Noten' }} />
      <Stack.Screen name="viewer" options={{ title: 'Note' }} />
      <Stack.Screen name="upload" options={{ title: 'Noten hochladen', presentation: 'modal' }} />
    </Stack>
  );
}
