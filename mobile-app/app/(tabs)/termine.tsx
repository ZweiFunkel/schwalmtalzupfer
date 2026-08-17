import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchKalenderTermine, kalenderIcsUrl, KalenderTermin, Kategorie } from '../../lib/kalender';
import { font, radius, spacing, type ColorTokens } from '../../lib/theme';
import { useAppTheme } from '../../lib/ThemeContext';

const EXPORT_MONTHS = 3;
const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

interface DateRange {
  von: string;
  bis: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addMonthsIso(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function defaultRange(): DateRange {
  const von = todayIso();
  return { von, bis: addMonthsIso(von, EXPORT_MONTHS) };
}

function formatDateDE(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function weekdayDE(iso: string): string {
  return WOCHENTAGE[new Date(`${iso}T00:00:00`).getDay()];
}

function formatZeit(von: string | null, bis: string | null): string | null {
  if (!von) return null;
  const short = (t: string) => t.slice(0, 5);
  return bis ? `${short(von)} – ${short(bis)} Uhr` : `${short(von)} Uhr`;
}

interface KategorieMeta {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const KATEGORIE_META: Record<Kategorie, KategorieMeta> = {
  konzert: { label: 'Konzert', icon: 'musical-notes' },
  jugend: { label: 'Jugendgruppe', icon: 'people' },
  ausflug: { label: 'Ausflug', icon: 'bus' },
  unterricht: { label: 'Unterricht', icon: 'school' },
  sonstige: { label: 'Termin', icon: 'calendar' },
};

function kategorieMeta(kategorie: Kategorie): KategorieMeta {
  return KATEGORIE_META[kategorie] ?? KATEGORIE_META.sonstige;
}

interface Section {
  title: string;
  data: KalenderTermin[];
}

function groupByDate(termine: KalenderTermin[]): Section[] {
  const sorted = [...termine].sort((a, b) => {
    if (a.startDatum !== b.startDatum) return a.startDatum.localeCompare(b.startDatum);
    const av = a.uhrzeitVon ?? '99:99';
    const bv = b.uhrzeitVon ?? '99:99';
    return av.localeCompare(bv);
  });

  const sections: Section[] = [];
  for (const item of sorted) {
    const last = sections[sections.length - 1];
    if (last && last.title === item.startDatum) {
      last.data.push(item);
    } else {
      sections.push({ title: item.startDatum, data: [item] });
    }
  }
  return sections;
}

export default function TermineScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [range, setRange] = useState<DateRange>(defaultRange);
  const [termine, setTermine] = useState<KalenderTermin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    const nextRange = defaultRange();
    try {
      const data = await fetchKalenderTermine(nextRange.von, nextRange.bis);
      setTermine(data);
      setRange(nextRange);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kalender konnte nicht geladen werden');
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

  const onExport = useCallback(async () => {
    setExporting(true);
    try {
      const url = kalenderIcsUrl(range.von, range.bis);
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Fehler', 'Es konnte keine App zum Öffnen des Kalenders gefunden werden.');
      }
    } catch {
      Alert.alert('Fehler', 'Kalender konnte nicht exportiert werden.');
    } finally {
      setExporting(false);
    }
  }, [range]);

  const sections = useMemo(() => groupByDate(termine), [termine]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary600} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.exportBar}>
        <Pressable style={styles.exportButton} onPress={onExport} disabled={exporting} hitSlop={8}>
          {exporting ? (
            <ActivityIndicator size="small" color={colors.primary600} />
          ) : (
            <Ionicons name="download-outline" size={16} color={colors.primary600} />
          )}
          <Text style={styles.exportButtonText}>Kalender exportieren</Text>
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary600} />}
        ListEmptyComponent={<Text style={styles.empty}>Keine Termine in diesem Zeitraum.</Text>}
        contentContainerStyle={styles.listContent}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>
              {weekdayDE(section.title)}, {formatDateDE(section.title)}
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const meta = kategorieMeta(item.kategorie);
          const zeit = formatZeit(item.uhrzeitVon, item.uhrzeitBis);
          const isGeneratedLesson = item.generiert && item.istUnterricht;
          const cancelledLabel = item.istUnterricht ? 'Kein Unterricht' : 'Abgesagt';
          return (
            <View
              style={[
                styles.card,
                isGeneratedLesson && styles.cardGenerated,
                item.abgesagt && styles.cardCancelled,
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconBadge, { backgroundColor: colors.primary50 }]}>
                  <Ionicons name={meta.icon} size={16} color={colors.primary600} />
                </View>
                <Text style={styles.categoryLabel}>{meta.label}</Text>
                {item.endDatum && item.endDatum !== item.startDatum && (
                  <Text style={styles.rangeLabel}>bis {formatDateDE(item.endDatum)}</Text>
                )}
              </View>

              <Text style={styles.title}>{item.titel}</Text>

              {zeit && (
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.meta}>{zeit}</Text>
                </View>
              )}
              {item.ort && (
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.meta}>{item.ort}</Text>
                </View>
              )}
              {item.beschreibung && (
                <Text style={styles.note} numberOfLines={4}>{item.beschreibung}</Text>
              )}

              {item.abgesagt && (
                <View style={styles.cancelledBadge}>
                  <Ionicons name="close-circle" size={14} color={colors.danger} />
                  <Text style={styles.cancelled}>
                    {cancelledLabel}{item.absageGrund ? `: ${item.absageGrund}` : ''}
                  </Text>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surfaceMuted },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    exportBar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
    },
    exportButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: radius.full,
      backgroundColor: colors.primary50,
    },
    exportButtonText: { fontSize: 13, fontFamily: font.semiBold, color: colors.primary600 },
    listContent: { padding: spacing.md, paddingTop: spacing.sm },
    sectionHeader: { paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
    sectionHeaderText: {
      fontSize: 12,
      fontFamily: font.semiBold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: colors.textFaint,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardGenerated: { backgroundColor: colors.surfaceMuted },
    cardCancelled: { opacity: 0.6 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
    iconBadge: { width: 24, height: 24, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' },
    categoryLabel: { fontSize: 12, fontFamily: font.semiBold, color: colors.primary600, flex: 1 },
    rangeLabel: { fontSize: 12, fontFamily: font.medium, color: colors.textFaint },
    title: { fontSize: 17, fontFamily: font.bold, color: colors.text, marginBottom: spacing.xs },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    meta: { fontSize: 14, color: colors.textMuted, fontFamily: font.regular },
    note: { fontSize: 13, color: colors.textMuted, fontFamily: font.regular, marginTop: spacing.sm },
    cancelledBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
    cancelled: { fontSize: 13, color: colors.danger, fontFamily: font.semiBold },
    empty: { textAlign: 'center', color: colors.textFaint, fontFamily: font.regular, marginTop: spacing.xl },
    error: { color: colors.danger, padding: spacing.md, textAlign: 'center', fontFamily: font.medium },
  });
}
