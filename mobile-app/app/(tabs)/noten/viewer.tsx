import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ensureNoteAvailable } from '../../../lib/notenCache';
import { colors, font, radius, spacing } from '../../../lib/theme';

// Android-WebViews können PDFs nicht darstellen (kein eingebauter PDF-Renderer wie bei
// iOS' WKWebView) und brechen mit net::ERR_ACCESS_DENIED ab. Also an die native
// PDF-Anwendung des Geräts übergeben statt in der WebView zu rendern.
function isPdf(name?: string, key?: string): boolean {
  return /\.pdf$/i.test(name ?? '') || /\.pdf$/i.test(key ?? '');
}

export default function NoteViewer() {
  const { key, name } = useLocalSearchParams<{ key: string; name?: string }>();
  const navigation = useNavigation();
  const pdf = isPdf(name, key);

  const [localUri, setLocalUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    navigation.setOptions({ title: name ?? 'Note' });
  }, [name, navigation]);

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

  const openExternally = useCallback(async (uri: string) => {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      setError('Kein PDF-Betrachter auf diesem Gerät verfügbar.');
      return;
    }
    try {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: name });
    } catch {
      setError('Note konnte nicht geöffnet werden.');
    }
  }, [name]);

  useEffect(() => {
    if (pdf && localUri) openExternally(localUri);
  }, [pdf, localUri, openExternally]);

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
        <Text style={styles.hint}>Ohne Internetverbindung nur bereits geöffnete Noten verfügbar.</Text>
        <Pressable style={styles.retry} onPress={() => setAttempt(a => a + 1)}>
          <Text style={styles.retryText}>Erneut versuchen</Text>
        </Pressable>
      </View>
    );
  }

  if (pdf) {
    return (
      <View style={styles.center}>
        <Ionicons name="document-text-outline" size={40} color={colors.textFaint} style={{ marginBottom: spacing.sm }} />
        <Text style={styles.hint}>{name}</Text>
        <Pressable style={styles.retry} onPress={() => openExternally(localUri)}>
          <Text style={styles.retryText}>Erneut öffnen</Text>
        </Pressable>
      </View>
    );
  }

  return <WebView source={{ uri: localUri }} originWhitelist={['*']} style={styles.webview} />;
}

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  error: { color: colors.danger, textAlign: 'center', marginBottom: spacing.xs, fontSize: 16, fontFamily: font.semiBold },
  hint: { color: colors.textFaint, textAlign: 'center', marginTop: spacing.xs, fontFamily: font.regular, fontSize: 13 },
  retry: { marginTop: spacing.md, backgroundColor: colors.primary600, paddingVertical: 12, paddingHorizontal: 24, borderRadius: radius.md },
  retryText: { color: '#fff', fontFamily: font.semiBold, fontSize: 15 },
});
