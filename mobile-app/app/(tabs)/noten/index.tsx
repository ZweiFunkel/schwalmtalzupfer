import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  browseNoten,
  folderNameFromPrefix,
  noteNameFromKey,
  listAllNoten,
  getNotenRootPrefix,
  NotenBrowseResult,
} from '../../../lib/noten';
import { getCachedUri, listCachedNoten, downloadMany } from '../../../lib/notenCache';
import { fetchMe, isBoard, isChef } from '../../../lib/auth';
import { font, radius, spacing, columnsForWidth, type ColorTokens } from '../../../lib/theme';
import { useAppTheme } from '../../../lib/ThemeContext';

type Row =
  | { kind: 'folder'; prefix: string; name: string }
  | { kind: 'file'; key: string; name: string; cached: boolean };

export default function NotenBrowser() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { prefix: prefixParam } = useLocalSearchParams<{ prefix?: string }>();
  const { width } = useWindowDimensions();
  const columns = columnsForWidth(width);

  // Der konfigurierte Noten-Root-Ordner (Admin > noten_prefix) gilt nur an der Wurzel —
  // Unterordner kommen bereits als vollständige Präfixe von browseNoten().
  const [rootPrefix, setRootPrefix] = useState<string | null>(null);
  const prefix = prefixParam ?? rootPrefix ?? '';

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [offline, setOffline] = useState(false);
  const [canUpload, setCanUpload] = useState(false);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloadingKeys, setDownloadingKeys] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  const isSearching = query.trim().length > 0;

  useEffect(() => {
    let cancelled = false;
    getNotenRootPrefix()
      .then(p => { if (!cancelled) setRootPrefix(p); })
      .catch(() => { if (!cancelled) setRootPrefix(''); });
    fetchMe()
      .then(p => { if (!cancelled) setCanUpload(isBoard(p) || isChef(p)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const loadBrowse = useCallback(async () => {
    const result: NotenBrowseResult = await browseNoten(prefix);
    const folderRows: Row[] = result.folders.map(f => ({
      kind: 'folder',
      prefix: f,
      name: folderNameFromPrefix(f),
    }));
    const fileRows: Row[] = await Promise.all(
      result.files.map(async key => ({
        kind: 'file' as const,
        key,
        name: noteNameFromKey(key),
        cached: (await getCachedUri(key)) !== null,
      }))
    );
    return [...folderRows, ...fileRows];
  }, [prefix]);

  const loadSearch = useCallback(async (term: string) => {
    const all = await listAllNoten(rootPrefix ?? '');
    const needle = term.trim().toLowerCase();
    const matches = all.filter(n => n.name.toLowerCase().includes(needle));
    return Promise.all(
      matches.map(async n => ({
        kind: 'file' as const,
        key: n.key,
        name: n.name,
        cached: (await getCachedUri(n.key)) !== null,
      }))
    );
  }, [rootPrefix]);

  // Ohne Internet (oder nicht angemeldet) zeigen wir statt eines Fehlers einfach
  // alles, was schon lokal heruntergeladen ist - App bleibt für gespeicherte Noten nutzbar.
  const loadOfflineFallback = useCallback(async (term: string): Promise<Row[]> => {
    const cached = await listCachedNoten();
    const needle = term.trim().toLowerCase();
    const filtered = needle ? cached.filter(c => c.name.toLowerCase().includes(needle)) : cached;
    return filtered
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(c => ({ kind: 'file' as const, key: c.key, name: c.name, cached: true }));
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = isSearching ? await loadSearch(query) : await loadBrowse();
      setRows(result);
      setOffline(false);
    } catch (e) {
      const fallback = await loadOfflineFallback(query);
      setRows(fallback);
      setOffline(true);
      if (fallback.length === 0) {
        setError(e instanceof Error ? e.message : 'Fehler beim Laden');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isSearching, loadSearch, loadBrowse, loadOfflineFallback, query]);

  // An der Wurzel erst laden, wenn der konfigurierte Noten-Ordner bekannt ist,
  // sonst würde kurz der gesamte Bucket statt des eingerichteten Ordners aufblitzen.
  const readyToLoad = prefixParam !== undefined || rootPrefix !== null;

  useFocusEffect(
    useCallback(() => {
      setSelectionMode(false);
      setSelected(new Set());
    }, [])
  );

  useEffect(() => {
    if (!readyToLoad) return;
    setLoading(true);
    load();
  }, [readyToLoad, load]);

  const emptyLabel = useMemo(
    () => (isSearching ? 'Keine Noten gefunden.' : offline ? 'Keine Noten heruntergeladen.' : 'Keine Noten in diesem Ordner.'),
    [isSearching, offline]
  );

  const markCached = useCallback((keys: string[]) => {
    const keySet = new Set(keys);
    setRows(prev => prev.map(r => (r.kind === 'file' && keySet.has(r.key) ? { ...r, cached: true } : r)));
  }, []);

  const downloadOne = useCallback(async (key: string) => {
    setDownloadingKeys(prev => new Set(prev).add(key));
    try {
      const { failed } = await downloadMany([key]);
      if (failed.length === 0) markCached([key]);
      else Alert.alert('Fehler', 'Note konnte nicht heruntergeladen werden.');
    } finally {
      setDownloadingKeys(prev => { const next = new Set(prev); next.delete(key); return next; });
    }
  }, [markCached]);

  const runBulkDownload = useCallback(async (keys: string[]) => {
    if (keys.length === 0) return;
    setBulkProgress({ done: 0, total: keys.length });
    try {
      const { succeeded, failed } = await downloadMany(keys, (done, total) => setBulkProgress({ done, total }));
      markCached(succeeded);
      Alert.alert(
        'Download abgeschlossen',
        failed.length > 0
          ? `${succeeded.length} Noten heruntergeladen, ${failed.length} fehlgeschlagen.`
          : `${succeeded.length} Noten heruntergeladen.`
      );
    } finally {
      setBulkProgress(null);
      setSelectionMode(false);
      setSelected(new Set());
    }
  }, [markCached]);

  const downloadAllInFolder = useCallback(async () => {
    try {
      const all = await listAllNoten(prefix);
      await runBulkDownload(all.map(n => n.key));
    } catch {
      Alert.alert('Fehler', 'Notenliste konnte nicht geladen werden.');
    }
  }, [prefix, runBulkDownload]);

  const toggleSelected = useCallback((key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const fileKeysInView = useMemo(
    () => rows.filter((r): r is Extract<Row, { kind: 'file' }> => r.kind === 'file').map(r => r.key),
    [rows]
  );

  const onRowPress = useCallback((item: Row) => {
    if (item.kind === 'folder') {
      router.push({ pathname: '/(tabs)/noten', params: { prefix: item.prefix } });
      return;
    }
    if (selectionMode) {
      toggleSelected(item.key);
      return;
    }
    router.push({ pathname: '/(tabs)/noten/viewer', params: { key: item.key, name: item.name } });
  }, [selectionMode, toggleSelected]);

  const onRowLongPress = useCallback((item: Row) => {
    if (item.kind !== 'file') return;
    if (!selectionMode) setSelectionMode(true);
    toggleSelected(item.key);
  }, [selectionMode, toggleSelected]);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelected(new Set());
  }, []);

  const bulkBusy = bulkProgress !== null;

  return (
    <View style={styles.container}>
      {selectionMode ? (
        <View style={styles.selectionBar}>
          <Pressable onPress={exitSelection} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.selectionText}>{selected.size} ausgewählt</Text>
          <Pressable
            onPress={() => setSelected(new Set(fileKeysInView))}
            hitSlop={8}
            style={styles.selectionTextBtn}
          >
            <Text style={styles.selectionTextBtnLabel}>Alle</Text>
          </Pressable>
          <Pressable
            onPress={() => runBulkDownload(Array.from(selected))}
            hitSlop={8}
            disabled={selected.size === 0 || bulkBusy}
          >
            <Ionicons
              name="cloud-download-outline"
              size={22}
              color={selected.size === 0 || bulkBusy ? colors.textFaint : colors.primary600}
            />
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.textFaint} />
            <TextInput
              style={styles.searchInput}
              placeholder="Noten durchsuchen…"
              placeholderTextColor={colors.textFaint}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textFaint} />
              </Pressable>
            )}
          </View>

          <View style={styles.toolbar}>
            {offline ? (
              <View style={styles.offlineBadge}>
                <Ionicons name="cloud-offline-outline" size={14} color={colors.textMuted} />
                <Text style={styles.offlineText}>Offline – zeigt heruntergeladene Noten</Text>
              </View>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            {!offline && !isSearching && fileKeysInView.length > 0 && (
              <Pressable onPress={downloadAllInFolder} hitSlop={8} disabled={bulkBusy} style={styles.toolbarBtn}>
                <Ionicons name="cloud-download-outline" size={20} color={bulkBusy ? colors.textFaint : colors.primary600} />
              </Pressable>
            )}
            {canUpload && !isSearching && !offline && (
              <Pressable
                onPress={() => router.push({ pathname: '/(tabs)/noten/upload', params: { prefix } })}
                hitSlop={8}
                style={styles.toolbarBtn}
              >
                <Ionicons name="add-circle-outline" size={22} color={colors.primary600} />
              </Pressable>
            )}
          </View>
        </>
      )}

      {bulkProgress && (
        <Text style={styles.progress}>Lade herunter … {bulkProgress.done}/{bulkProgress.total}</Text>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary600} />
        </View>
      ) : (
        <FlatList
          key={columns}
          data={rows}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? styles.rowWrap : undefined}
          contentContainerStyle={styles.listContent}
          keyExtractor={item => (item.kind === 'folder' ? `f:${item.prefix}` : `n:${item.key}`)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary600} />}
          ListEmptyComponent={<Text style={styles.empty}>{emptyLabel}</Text>}
          renderItem={({ item }) => {
            const checked = item.kind === 'file' && selected.has(item.key);
            const isDownloading = item.kind === 'file' && downloadingKeys.has(item.key);
            return (
              <Pressable
                style={[styles.card, columns > 1 && styles.cardGrid, checked && styles.cardChecked]}
                onPress={() => onRowPress(item)}
                onLongPress={() => onRowLongPress(item)}
              >
                {item.kind === 'folder' ? (
                  <>
                    <View style={[styles.iconBadge, { backgroundColor: colors.primary50 }]}>
                      <Ionicons name="folder" size={20} color={colors.primary600} />
                    </View>
                    <Text style={styles.cardText} numberOfLines={2}>{item.name}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                  </>
                ) : (
                  <>
                    {selectionMode ? (
                      <Ionicons
                        name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={checked ? colors.primary600 : colors.textFaint}
                      />
                    ) : (
                      <View style={[styles.iconBadge, { backgroundColor: colors.surfaceMuted }]}>
                        <Ionicons name="document-text" size={20} color={colors.textMuted} />
                      </View>
                    )}
                    <Text style={styles.cardText} numberOfLines={2}>{item.name}</Text>
                    {!selectionMode && (
                      isDownloading ? (
                        <ActivityIndicator size="small" color={colors.primary600} />
                      ) : item.cached ? (
                        <Ionicons name="checkmark-circle" size={18} color={colors.primary600} />
                      ) : (
                        <Pressable onPress={() => downloadOne(item.key)} hitSlop={8}>
                          <Ionicons name="cloud-download-outline" size={20} color={colors.textMuted} />
                        </Pressable>
                      )
                    )}
                  </>
                )}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceMuted },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 15, color: colors.text },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  toolbarBtn: { padding: spacing.xs },
  offlineBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 },
  offlineText: { color: colors.textMuted, fontFamily: font.medium, fontSize: 12 },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    marginHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  selectionText: { flex: 1, fontFamily: font.semiBold, fontSize: 14, color: colors.text },
  selectionTextBtn: { paddingHorizontal: spacing.xs },
  selectionTextBtnLabel: { color: colors.primary600, fontFamily: font.semiBold, fontSize: 13 },
  progress: { textAlign: 'center', color: colors.textMuted, fontFamily: font.medium, fontSize: 12, marginBottom: spacing.xs },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  rowWrap: { gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardGrid: { flex: 1 },
  cardChecked: { borderColor: colors.primary600, backgroundColor: colors.primary50 },
  iconBadge: { width: 36, height: 36, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' },
  cardText: { flex: 1, fontFamily: font.medium, fontSize: 15, color: colors.text },
  empty: { textAlign: 'center', color: colors.textFaint, fontFamily: font.regular, marginTop: spacing.xl },
  error: { color: colors.danger, fontFamily: font.medium, padding: spacing.md, textAlign: 'center' },
  });
}
