import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ensureNoteAvailable } from '../../../lib/notenCache';
import { colors, font, radius, spacing } from '../../../lib/theme';

export default function NoteViewer() {
  const { key, name } = useLocalSearchParams<{ key: string; name?: string }>();
  const navigation = useNavigation();

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
