import { Stack } from 'expo-router';
import { font } from '../../../lib/theme';
import { useAppTheme } from '../../../lib/ThemeContext';

export default function VerwaltungLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Verwaltung' }} />
      <Stack.Screen name="mitglieder" options={{ title: 'Mitglieder' }} />
      <Stack.Screen name="seiten" options={{ title: 'Seiten' }} />
    </Stack>
  );
}
