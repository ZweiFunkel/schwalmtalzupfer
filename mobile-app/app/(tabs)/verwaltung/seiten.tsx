import { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Switch, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { fetchPages, fetchHiddenSlugs, setMenuVisibility, PageMeta } from '../../../lib/pages';
import { font, radius, spacing, type ColorTokens } from '../../../lib/theme';
import { useAppTheme } from '../../../lib/ThemeContext';

export default function SeitenScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [pages, setPages] = useState<PageMeta[]>([]);
  const [hiddenSlugs, setHiddenSlugs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pgs, hidden] = await Promise.all([fetchPages(), fetchHiddenSlugs()]);
      setPages(pgs);
      setHiddenSlugs(new Set(hidden));
    } catch {
      // Liste bleibt leer, Fehler ist nicht kritisch für die Ansicht
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const visiblePages = useMemo(() => pages.filter(p => !!p.slug), [pages]);

  async function toggleVisibility(slug: string, currentlyHidden: boolean) {
    const nextHidden = !currentlyHidden;
    setHiddenSlugs(prev => {
      const next = new Set(prev);
      if (nextHidden) next.add(slug); else next.delete(slug);
      return next;
    });
    try {
      await setMenuVisibility(slug, nextHidden);
    } catch (e) {
      setHiddenSlugs(prev => {
        const next = new Set(prev);
        if (currentlyHidden) next.add(slug); else next.delete(slug);
        return next;
      });
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Sichtbarkeit konnte nicht geändert werden');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Verstecken entfernt nur den Link im Menü – die Seite bleibt über ihre Adresse weiter erreichbar.
      </Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary600} />
        </View>
      ) : (
        <FlatList
          data={visiblePages}
          keyExtractor={p => p.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary600} />}
          ListEmptyComponent={<Text style={styles.empty}>Keine Seiten vorhanden.</Text>}
          renderItem={({ item }) => {
            const hidden = hiddenSlugs.has(item.slug);
            return (
              <View style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.subtext}>/{item.slug}</Text>
                </View>
                <Switch
                  value={!hidden}
                  onValueChange={() => toggleVisibility(item.slug, hidden)}
                  trackColor={{ false: colors.border, true: colors.primary500 }}
                  thumbColor="#fff"
                />
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceMuted },
  hint: { fontFamily: font.regular, fontSize: 12, color: colors.textFaint, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  listContent: { padding: spacing.md, paddingTop: 0 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  title: { fontFamily: font.semiBold, fontSize: 15, color: colors.text },
  subtext: { fontFamily: font.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  empty: { textAlign: 'center', color: colors.textFaint, fontFamily: font.regular, marginTop: spacing.xl, padding: spacing.md },
  });
}
