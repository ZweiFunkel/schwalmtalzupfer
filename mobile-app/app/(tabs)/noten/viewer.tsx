import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Platform } from 'react-native';
import { API_BASE } from '../../../lib/config';
import { getToken } from '../../../lib/auth';
import { WebView } from '../../../components/WebView';
import PdfView from '../../../components/PdfView';
import { canShareFile, shareFile } from '../../../lib/share';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { downloadNote, ensureNoteAvailable } from '../../../lib/notenCache';
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
  const [viewerToken, setViewerToken] = useState('');
  const [viewerFailed, setViewerFailed] = useState(false);
  const router = useRouter();

  useEffect(() => { getToken().then(t => setViewerToken(t ?? '')).catch(() => {}); }, []);

  const share = useCallback(async (uri: string) => {
    if (await canShareFile()) {
      shareFile(uri, name).catch(() => {});
    }
  }, [name]);

  useEffect(() => {
    navigation.setOptions({
      title: name ?? 'Note',
      // Web: der Noten-Viewer bringt eigene Leiste (Zurück, Zoom, Bearbeiten) mit
      headerShown: !(pdf && Platform.OS === 'web'),
      headerRight: () =>
        localUri ? (
          <Pressable onPress={() => share(localUri)} hitSlop={12} style={{ paddingHorizontal: spacing.sm }}>
            <Ionicons name="share-outline" size={22} color={colors.primary600} />
          </Pressable>
        ) : null,
    });
  }, [name, navigation, localUri, share, colors, pdf]);

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
    // Online: gemeinsamer Noten-Viewer (Zoomstufen, Bearbeiten für Vorstand/Admin, Versionen).
    // Offline oder bei Fehler: wie bisher die lokale Datei im nativen PDF-Viewer.
    const useWebViewer = Platform.OS !== 'web' && !viewerFailed && !!viewerToken;
    if (useWebViewer) {
      const uri = `${API_BASE}/noten-viewer?key=${encodeURIComponent(key)}#token=${encodeURIComponent(viewerToken)}`;
      return (
        <View style={styles.pdf}>
          <WebView
            source={{ uri }}
            originWhitelist={[API_BASE]}
            style={styles.pdf}
            onError={() => setViewerFailed(true)}
            onHttpError={() => setViewerFailed(true)}
            onMessage={e => {
              try {
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg?.source !== 'noten-viewer') return;
                if (msg.type === 'close') router.back();
                // Gespeicherte Fassung in den Offline-Speicher übernehmen
                else if (msg.type === 'saved') downloadNote(key).catch(() => {});
              } catch {}
            }}
          />
        </View>
      );
    }
    return (
      <View style={styles.pdf}>
        <PdfView uri={localUri} noteKey={key} onClose={() => router.back()} onError={() => setError('PDF konnte nicht angezeigt werden')} />
      </View>
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
