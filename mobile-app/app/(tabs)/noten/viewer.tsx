import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import Pdf from 'react-native-pdf';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ensureNoteAvailable } from '../../../lib/notenCache';
import { font, radius, spacing, type ColorTokens } from '../../../lib/theme';
import { useAppTheme } from '../../../lib/ThemeContext';

function isPdf(name?: string, key?: string): boolean {
  return /\.pdf$/i.test(name ?? '') || /\.pdf$/i.test(key ?? '');
}

export default function NoteViewer() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { key, name } = useLocalSearchParams<{ key: string; name?: string }>();
  const navigation = useNavigation();
  const pdf = isPdf(name, key);

  const [localUri, setLocalUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  const share = useCallback(async (uri: string) => {
    if (await Sharing.isAvailableAsync()) {
      Sharing.shareAsync(uri, { dialogTitle: name }).catch(() => {});
    }
  }, [name]);

  useEffect(() => {
    navigation.setOptions({
      title: name ?? 'Note',
      headerRight: () =>
        localUri ? (
          <Pressable onPress={() => share(localUri)} hitSlop={12} style={{ paddingHorizontal: spacing.sm }}>
            <Ionicons name="share-outline" size={22} color={colors.primary600} />
          </Pressable>
        ) : null,
    });
  }, [name, navigation, localUri, share, colors]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    ensureNoteAvailable(key)
      .then(uri => { if (!cancelled) setLocalUri(uri); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Note konnte nicht geladen werden'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [key, attempt]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary600} size="large" />
        <Text style={styles.hint}>Lade Note…</Text>
      </View>
    );
  }

  if (error || !localUri) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.textFaint} style={{ marginBottom: spacing.sm }} />
        <Text style={styles.error}>{error ?? 'Note nicht verfügbar'}</Text>
        <Text style={styles.hint}>Ohne Internetverbindung nur bereits heruntergeladene Noten verfügbar.</Text>
        <Pressable style={styles.retry} onPress={() => setAttempt(a => a + 1)}>
          <Text style={styles.retryText}>Erneut versuchen</Text>
        </Pressable>
      </View>
    );
  }

  if (pdf) {
    return (
      <Pdf
        source={{ uri: localUri }}
        style={styles.pdf}
        trustAllCerts={false}
        onError={() => setError('PDF konnte nicht angezeigt werden')}
      />
    );
  }

  return <WebView source={{ uri: localUri }} originWhitelist={['*']} style={styles.webview} />;
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  pdf: { flex: 1, backgroundColor: colors.surfaceMuted },
  webview: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.surfaceMuted },
  error: { color: colors.danger, textAlign: 'center', marginBottom: spacing.xs, fontSize: 16, fontFamily: font.semiBold },
  hint: { color: colors.textFaint, textAlign: 'center', marginTop: spacing.xs, fontFamily: font.regular, fontSize: 13 },
  retry: { marginTop: spacing.md, backgroundColor: colors.primary600, paddingVertical: 12, paddingHorizontal: 24, borderRadius: radius.md },
  retryText: { color: '#fff', fontFamily: font.semiBold, fontSize: 15 },
  });
}
