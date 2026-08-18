import { Stack } from 'expo-router';
import { font } from '../../../lib/theme';
import { useAppTheme } from '../../../lib/ThemeContext';

export default function InternLayout() {
  const { colors } = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerTitleAlign: 'center',
        headerTitleStyle: { fontFamily: font.semiBold, fontSize: 17, color: colors.text },
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTintColor: colors.primary600,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Intern' }} />
      <Stack.Screen name="videos" options={{ title: 'Videos' }} />
      <Stack.Screen name="merch" options={{ title: 'Merch' }} />
      <Stack.Screen name="galerie" options={{ title: 'Interne Galerie' }} />
    </Stack>
  );
}
