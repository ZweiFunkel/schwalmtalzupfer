import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Application from 'expo-application';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE } from '../lib/api';
import { font, radius, spacing, type ColorTokens } from '../lib/theme';
import { useAppTheme } from '../lib/ThemeContext';

interface AndroidAppVersion {
  versionCode?: number;
  versionName?: string;
  releaseNotes?: string;
}

// Solange die App nicht im Play Store ist, prüft die App selbst gegen den vom
// CI-Workflow gepflegten site_settings-Eintrag "android_app_version" (siehe
// AppUpdateController), ob eine neuere APK verfügbar ist. Sobald die App im Play Store
// läuft, muss dieser Banner durch die Play In-App-Update-API ersetzt werden – ein
// selbstgehosteter Update-Download ist dann laut Play-Richtlinien nicht mehr erlaubt.
export default function UpdateBanner() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState<AndroidAppVersion | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/site/settings`)
      .then(r => (r.ok ? r.json() : {}))
      .then((data: Record<string, string>) => {
        if (cancelled || !data.android_app_version) return;
        try {
          setInfo(JSON.parse(data.android_app_version));
        } catch {
          // ungültiger/leerer Settings-Wert -> kein Update anzeigen
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const installedCode = Number(Application.nativeBuildVersion ?? 0);
  const updateAvailable = !!info?.versionCode && info.versionCode > installedCode;

  if (!updateAvailable || dismissed) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + 6 }]}>
      <Ionicons name="arrow-up-circle" size={20} color="#fff" />
      <Text style={styles.text} numberOfLines={1}>
        Update verfügbar{info?.versionName ? ` (v${info.versionName})` : ''}
      </Text>
      <Pressable style={styles.action} onPress={() => Linking.openURL(`${API_BASE}/api/app/android/download`)}>
        <Text style={styles.actionText}>Laden</Text>
      </Pressable>
      <Pressable hitSlop={8} onPress={() => setDismissed(true)}>
        <Ionicons name="close" size={18} color="#fff" />
      </Pressable>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary600,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  text: { flex: 1, color: '#fff', fontFamily: font.medium, fontSize: 13 },
  action: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  actionText: { color: '#fff', fontFamily: font.semiBold, fontSize: 12 },
  });
}
