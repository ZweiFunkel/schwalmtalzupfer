import { Stack } from 'expo-router';
import { font } from '../../../lib/theme';
import { useAppTheme } from '../../../lib/ThemeContext';

export default function NotenLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Noten' }} />
      <Stack.Screen name="viewer" options={{ title: 'Note' }} />
      <Stack.Screen name="upload" options={{ title: 'Noten hochladen', presentation: 'modal' }} />
    </Stack>
  );
}
