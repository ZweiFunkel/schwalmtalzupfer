import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  browseNoten,
  folderNameFromPrefix,
  noteNameFromKey,
  listAllNoten,
  NotenBrowseResult,
} from '../../../lib/noten';
import { getCachedUri } from '../../../lib/notenCache';
import { colors, font, radius, spacing, columnsForWidth } from '../../../lib/theme';

type Row =
  | { kind: 'folder'; prefix: string; name: string }
  | { kind: 'file'; key: string; name: string; cached: boolean };

export default function NotenBrowser() {
  const { prefix: prefixParam } = useLocalSearchParams<{ prefix?: string }>();
  const prefix = prefixParam ?? '';
  const { width } = useWindowDimensions();
  const columns = columnsForWidth(width);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const isSearching = query.trim().length > 0;

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
    const all = await listAllNoten();
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
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(isSearching ? await loadSearch(query) : await loadBrowse());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isSearching, loadSearch, loadBrowse, query]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const emptyLabel = useMemo(
    () => (isSearching ? 'Keine Noten gefunden.' : 'Keine Noten in diesem Ordner.'),
    [isSearching]
  );

  return (
    <View style={styles.container}>
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
          renderItem={({ item }) =>
            item.kind === 'folder' ? (
              <Pressable
                style={[styles.card, columns > 1 && styles.cardGrid]}
                onPress={() => router.push({ pathname: '/(tabs)/noten', params: { prefix: item.prefix } })}
              >
                <View style={[styles.iconBadge, { backgroundColor: colors.primary50 }]}>
                  <Ionicons name="folder" size={20} color={colors.primary600} />
                </View>
                <Text style={styles.cardText} numberOfLines={2}>{item.name}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </Pressable>
            ) : (
              <Pressable
                style={[styles.card, columns > 1 && styles.cardGrid]}
                onPress={() => router.push({ pathname: '/(tabs)/noten/viewer', params: { key: item.key, name: item.name } })}
              >
                <View style={[styles.iconBadge, { backgroundColor: colors.surfaceMuted }]}>
                  <Ionicons name="document-text" size={20} color={colors.textMuted} />
                </View>
                <Text style={styles.cardText} numberOfLines={2}>{item.name}</Text>
                {item.cached && <Ionicons name="checkmark-circle" size={18} color={colors.primary600} />}
              </Pressable>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  iconBadge: { width: 36, height: 36, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' },
  cardText: { flex: 1, fontFamily: font.medium, fontSize: 15, color: colors.text },
  empty: { textAlign: 'center', color: colors.textFaint, fontFamily: font.regular, marginTop: spacing.xl },
  error: { color: colors.danger, fontFamily: font.medium, padding: spacing.md, textAlign: 'center' },
});
