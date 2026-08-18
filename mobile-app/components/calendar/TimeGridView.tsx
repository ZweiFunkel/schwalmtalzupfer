import { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import type { KalenderTermin } from '../../lib/kalender';
import { kategorieMeta } from '../../lib/kalenderKategorie';
import { WOCHENTAGE_KURZ, isSameDay, timeToMinutes } from '../../lib/calendarDate';
import { eventsOnDay, isAllDay } from '../../lib/calendarEvents';
import { font, radius, spacing, type ColorTokens } from '../../lib/theme';
import { useAppTheme } from '../../lib/ThemeContext';

const START_HOUR = 7;
const END_HOUR = 22;
const HOUR_HEIGHT = 52;
const GUTTER_WIDTH = 36;

export default function TimeGridView({
  days, events, today, onSelectEvent,
}: {
  days: Date[];
  events: KalenderTermin[];
  today: Date;
  onSelectEvent: (e: KalenderTermin) => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const columnWidth = (width - spacing.md * 2 - GUTTER_WIDTH) / days.length;
  const hasAllDay = days.some(d => eventsOnDay(events, d).some(isAllDay));

  return (
    <View style={styles.container}>
      {/* Kopfzeile */}
      <View style={styles.headerRow}>
        <View style={{ width: GUTTER_WIDTH }} />
        {days.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <View key={i} style={[styles.dayHeaderCell, { width: columnWidth }]}>
              <Text style={styles.dayHeaderWeekday}>{WOCHENTAGE_KURZ[(d.getDay() + 6) % 7]}</Text>
              <View style={[styles.dayHeaderNum, isToday && styles.dayHeaderNumToday]}>
                <Text style={[styles.dayHeaderNumText, isToday && styles.dayHeaderNumTextToday]}>{d.getDate()}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Ganztägige Termine */}
      {hasAllDay && (
        <View style={styles.allDayRow}>
          <View style={{ width: GUTTER_WIDTH }}>
            <Text style={styles.gutterLabel}>ganztägig</Text>
          </View>
          {days.map((d, i) => (
            <View key={i} style={[styles.allDayCell, { width: columnWidth }]}>
              {eventsOnDay(events, d).filter(isAllDay).map(ev => {
                const meta = kategorieMeta(ev.kategorie);
                return (
                  <Pressable key={ev.id} onPress={() => onSelectEvent(ev)} style={[styles.allDayChip, { backgroundColor: meta.color + '26' }]}>
                    <Text numberOfLines={1} style={[styles.allDayChipText, { color: meta.color }]}>{ev.titel}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      )}

      {/* Stunden-Raster */}
      <ScrollView style={styles.scroll} nestedScrollEnabled>
        <View style={styles.gridRow}>
          <View style={{ width: GUTTER_WIDTH }}>
            {hours.map(h => (
              <View key={h} style={{ height: HOUR_HEIGHT }}>
                <Text style={styles.hourLabel}>{h}:00</Text>
              </View>
            ))}
          </View>
          {days.map((d, i) => {
            const timed = eventsOnDay(events, d).filter(ev => !isAllDay(ev));
            return (
              <View key={i} style={[styles.dayColumn, { width: columnWidth, height: hours.length * HOUR_HEIGHT }]}>
                {hours.map(h => <View key={h} style={styles.hourCell} />)}
                {timed.map(ev => {
                  const meta = kategorieMeta(ev.kategorie);
                  const startMin = Math.max(timeToMinutes(ev.uhrzeitVon!), START_HOUR * 60);
                  const endMin = Math.min(
                    ev.uhrzeitBis ? timeToMinutes(ev.uhrzeitBis) : startMin + 60,
                    (END_HOUR + 1) * 60
                  );
                  const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                  const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 22);
                  return (
                    <Pressable
                      key={ev.id}
                      onPress={() => onSelectEvent(ev)}
                      style={[styles.eventBlock, { top, height, backgroundColor: meta.color }]}
                    >
                      <Text numberOfLines={2} style={styles.eventBlockText}>{ev.titel}</Text>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    headerRow: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 6 },
    dayHeaderCell: { alignItems: 'center' },
    dayHeaderWeekday: { fontFamily: font.semiBold, fontSize: 10, color: colors.textMuted, textTransform: 'uppercase' },
    dayHeaderNum: { width: 22, height: 22, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    dayHeaderNumToday: { backgroundColor: colors.primary600 },
    dayHeaderNumText: { fontFamily: font.medium, fontSize: 12, color: colors.text },
    dayHeaderNumTextToday: { color: '#fff', fontFamily: font.bold },
    allDayRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 4 },
    gutterLabel: { fontSize: 8, color: colors.textFaint },
    allDayCell: { gap: 2, paddingHorizontal: 2 },
    allDayChip: { borderRadius: radius.sm, paddingHorizontal: 4, paddingVertical: 2 },
    allDayChipText: { fontFamily: font.medium, fontSize: 10 },
    scroll: { maxHeight: 440 },
    gridRow: { flexDirection: 'row' },
    hourLabel: { fontSize: 10, color: colors.textFaint, marginTop: -6 },
    dayColumn: { borderLeftWidth: 1, borderLeftColor: colors.border, position: 'relative' },
    hourCell: { height: HOUR_HEIGHT, borderBottomWidth: 1, borderBottomColor: colors.border },
    eventBlock: { position: 'absolute', left: 1, right: 1, borderRadius: radius.sm, padding: 3, justifyContent: 'center' },
    eventBlockText: { fontFamily: font.semiBold, fontSize: 10, color: '#fff' },
  });
}
