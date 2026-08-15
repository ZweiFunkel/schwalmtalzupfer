import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchTermine, Termin } from '../../lib/termine';
import { colors, font, radius, spacing, columnsForWidth } from '../../lib/theme';

export default function TermineScreen() {
  const { width } = useWindowDimensions();
  const columns = columnsForWidth(width);

  const [termine, setTermine] = useState<Termin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      setTermine(await fetchTermine());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Termine konnten nicht geladen werden');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary600} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        key={columns}
        data={termine}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.rowWrap : undefined}
        keyExtractor={(item, index) => `${item.title}-${item.date}-${index}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary600} />}
        ListEmptyComponent={<Text style={styles.empty}>Keine Termine eingetragen.</Text>}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={[styles.card, columns > 1 && styles.cardGrid, item.cancelled && styles.cardCancelled]}>
            <Text style={styles.date}>{item.date}</Text>
            <Text style={styles.title}>{item.title}</Text>
            {item.time && (
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <Text style={styles.meta}>{item.time}</Text>
              </View>
            )}
            {item.location && (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                <Text style={styles.meta}>{item.location}</Text>
              </View>
            )}
            {(item.note || item.details) && (
              <Text style={styles.note} numberOfLines={4}>{item.note ?? item.details}</Text>
            )}
            {item.cancelled && (
              <View style={styles.cancelledBadge}>
                <Ionicons name="close-circle" size={14} color={colors.danger} />
                <Text style={styles.cancelled}>Abgesagt{item.cancellationNote ? `: ${item.cancellationNote}` : ''}</Text>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: spacing.md },
  rowWrap: { gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardGrid: { flex: 1 },
  cardCancelled: { opacity: 0.6 },
  date: { fontSize: 13, color: colors.primary600, fontFamily: font.semiBold, marginBottom: spacing.xs },
  title: { fontSize: 17, fontFamily: font.bold, color: colors.text, marginBottom: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  meta: { fontSize: 14, color: colors.textMuted, fontFamily: font.regular },
  note: { fontSize: 13, color: colors.textMuted, fontFamily: font.regular, marginTop: spacing.sm },
  cancelledBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  cancelled: { fontSize: 13, color: colors.danger, fontFamily: font.semiBold },
  empty: { textAlign: 'center', color: colors.textFaint, fontFamily: font.regular, marginTop: spacing.xl },
  error: { color: colors.danger, padding: spacing.md, textAlign: 'center', fontFamily: font.medium },
});
