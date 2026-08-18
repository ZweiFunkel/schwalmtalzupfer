import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { fetchKalenderTermine, kalenderIcsUrl, KalenderTermin } from '../../lib/kalender';
import { kategorieMeta } from '../../lib/kalenderKategorie';
import {
  toIso, addDays, addMonths, startOfMonth, startOfWeek,
  MONATE, WOCHENTAGE_LANG,
} from '../../lib/calendarDate';
import { font, radius, spacing, type ColorTokens } from '../../lib/theme';
import { useAppTheme } from '../../lib/ThemeContext';
import MonthCalendarView from '../../components/calendar/MonthCalendarView';
import TimeGridView from '../../components/calendar/TimeGridView';
import EventDetailModal from '../../components/calendar/EventDetailModal';

type ViewMode = 'agenda' | 'monat' | 'woche' | 'tag';
const VIEW_OPTIONS: Array<{ key: ViewMode; label: string }> = [
  { key: 'agenda', label: 'Agenda' },
  { key: 'monat', label: 'Monat' },
  { key: 'woche', label: 'Woche' },
  { key: 'tag', label: 'Tag' },
];

const AGENDA_EXPORT_MONTHS = 3;

function pad2(n: number) { return n.toString().padStart(2, '0'); }
function formatDateDE(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
function weekdayShortDE(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()];
}
function formatZeit(von: string | null, bis: string | null): string | null {
  if (!von) return null;
  const short = (t: string) => t.slice(0, 5);
  return bis ? `${short(von)} – ${short(bis)} Uhr` : `${short(von)} Uhr`;
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
  const today = useMemo(() => new Date(), []);

  const [viewMode, setViewMode] = useState<ViewMode>('agenda');
  const [cursor, setCursor] = useState(() => new Date());
  const [termine, setTermine] = useState<KalenderTermin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<KalenderTermin | null>(null);

  // Sichtbaren Zeitraum je nach Ansicht berechnen (Agenda bleibt wie gehabt: heute + 3 Monate).
  const { von, bis } = useMemo(() => {
    if (viewMode === 'monat') {
      const gridStart = startOfWeek(startOfMonth(cursor));
      return { von: toIso(gridStart), bis: toIso(addDays(gridStart, 41)) };
    }
    if (viewMode === 'woche') {
      const ws = startOfWeek(cursor);
      return { von: toIso(ws), bis: toIso(addDays(ws, 6)) };
    }
    if (viewMode === 'tag') {
      return { von: toIso(cursor), bis: toIso(cursor) };
    }
    const von = toIso(today);
    const bisDate = addMonths(today, AGENDA_EXPORT_MONTHS);
    return { von, bis: toIso(bisDate) };
  }, [viewMode, cursor, today]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const data = await fetchKalenderTermine(von, bis);
      setTermine(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kalender konnte nicht geladen werden');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [von, bis]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onExport = useCallback(async () => {
    setExporting(true);
    try {
      const url = kalenderIcsUrl(von, bis);
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) await Linking.openURL(url);
      else Alert.alert('Fehler', 'Es konnte keine App zum Öffnen des Kalenders gefunden werden.');
    } catch {
      Alert.alert('Fehler', 'Kalender konnte nicht exportiert werden.');
    } finally {
      setExporting(false);
    }
  }, [von, bis]);

  const goPrev = useCallback(() => {
    setCursor(c => viewMode === 'monat' ? addMonths(c, -1) : viewMode === 'woche' ? addDays(c, -7) : addDays(c, -1));
  }, [viewMode]);
  const goNext = useCallback(() => {
    setCursor(c => viewMode === 'monat' ? addMonths(c, 1) : viewMode === 'woche' ? addDays(c, 7) : addDays(c, 1));
  }, [viewMode]);
  const goToday = useCallback(() => setCursor(new Date()), []);

  const periodLabel = useMemo(() => {
    if (viewMode === 'monat') return `${MONATE[cursor.getMonth()]} ${cursor.getFullYear()}`;
    if (viewMode === 'woche') {
      const ws = startOfWeek(cursor);
      const we = addDays(ws, 6);
      return `${pad2(ws.getDate())}.${pad2(ws.getMonth() + 1)}. – ${pad2(we.getDate())}.${pad2(we.getMonth() + 1)}.${we.getFullYear()}`;
    }
    return `${WOCHENTAGE_LANG[(cursor.getDay() + 6) % 7]}, ${cursor.getDate()}. ${MONATE[cursor.getMonth()]}`;
  }, [viewMode, cursor]);

  const sections = useMemo(() => groupByDate(termine), [termine]);

  return (
    <View style={styles.container}>
      <View style={styles.viewSwitcher}>
        {VIEW_OPTIONS.map(opt => (
          <Pressable
            key={opt.key}
            style={[styles.viewSwitcherBtn, viewMode === opt.key && styles.viewSwitcherBtnActive]}
            onPress={() => setViewMode(opt.key)}
          >
            <Text style={[styles.viewSwitcherText, viewMode === opt.key && styles.viewSwitcherTextActive]}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>

      {viewMode !== 'agenda' && (
        <View style={styles.navBar}>
          <Pressable onPress={goToday} style={styles.todayBtn}>
            <Text style={styles.todayBtnText}>Heute</Text>
          </Pressable>
          <View style={styles.navArrows}>
            <Pressable onPress={goPrev} hitSlop={8}><Ionicons name="chevron-back" size={20} color={colors.textMuted} /></Pressable>
            <Pressable onPress={goNext} hitSlop={8}><Ionicons name="chevron-forward" size={20} color={colors.textMuted} /></Pressable>
          </View>
          <Text style={styles.periodLabel} numberOfLines={1}>{periodLabel}</Text>
        </View>
      )}

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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary600} />
        </View>
      ) : viewMode === 'monat' ? (
        <View style={styles.gridWrap}>
          <MonthCalendarView
            cursor={cursor}
            events={termine}
            today={today}
            onSelectDay={d => { setCursor(d); setViewMode('tag'); }}
            onSelectEvent={setSelectedEvent}
          />
        </View>
      ) : viewMode === 'woche' ? (
        <View style={styles.gridWrap}>
          <TimeGridView
            days={Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))}
            events={termine}
            today={today}
            onSelectEvent={setSelectedEvent}
          />
        </View>
      ) : viewMode === 'tag' ? (
        <View style={styles.gridWrap}>
          <TimeGridView days={[cursor]} events={termine} today={today} onSelectEvent={setSelectedEvent} />
        </View>
      ) : (
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
                {weekdayShortDE(section.title)}, {formatDateDE(section.title)}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const meta = kategorieMeta(item.kategorie);
            const zeit = formatZeit(item.uhrzeitVon, item.uhrzeitBis);
            const isGeneratedLesson = item.generiert && item.istUnterricht;
            const cancelledLabel = item.istUnterricht ? 'Kein Unterricht' : 'Abgesagt';
            return (
              <Pressable
                onPress={() => setSelectedEvent(item)}
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
              </Pressable>
            );
          }}
        />
      )}

      <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surfaceMuted },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    viewSwitcher: {
      flexDirection: 'row', margin: spacing.md, marginBottom: spacing.sm,
      backgroundColor: colors.surface, borderRadius: radius.md, padding: 3,
      borderWidth: 1, borderColor: colors.border,
    },
    viewSwitcherBtn: { flex: 1, paddingVertical: 7, borderRadius: radius.sm, alignItems: 'center' },
    viewSwitcherBtnActive: { backgroundColor: colors.primary600 },
    viewSwitcherText: { fontFamily: font.medium, fontSize: 12, color: colors.textMuted },
    viewSwitcherTextActive: { color: '#fff', fontFamily: font.semiBold },
    navBar: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      paddingHorizontal: spacing.md, marginBottom: spacing.xs,
    },
    todayBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
    todayBtnText: { fontFamily: font.medium, fontSize: 12, color: colors.textMuted },
    navArrows: { flexDirection: 'row', gap: spacing.sm },
    periodLabel: { flex: 1, textAlign: 'right', fontFamily: font.semiBold, fontSize: 14, color: colors.text },
    gridWrap: { marginHorizontal: spacing.md, marginBottom: spacing.md },
    exportBar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
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
    listContent: { padding: spacing.md, paddingTop: 0 },
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
