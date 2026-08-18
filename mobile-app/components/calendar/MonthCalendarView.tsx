import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { KalenderTermin } from '../../lib/kalender';
import { kategorieMeta } from '../../lib/kalenderKategorie';
import { startOfMonth, startOfWeek, addDays, isSameDay, WOCHENTAGE_KURZ } from '../../lib/calendarDate';
import { eventsOnDay } from '../../lib/calendarEvents';
import { font, radius, spacing, type ColorTokens } from '../../lib/theme';
import { useAppTheme } from '../../lib/ThemeContext';

const MAX_DOTS = 4;

export default function MonthCalendarView({
  cursor, events, today, onSelectDay, onSelectEvent,
}: {
  cursor: Date;
  events: KalenderTermin[];
  today: Date;
  onSelectDay: (d: Date) => void;
  onSelectEvent: (e: KalenderTermin) => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const gridStart = startOfWeek(startOfMonth(cursor));
  const month = cursor.getMonth();
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d)));

  return (
    <View style={styles.container}>
      <View style={styles.weekHeaderRow}>
        {WOCHENTAGE_KURZ.map(w => <Text key={w} style={styles.weekHeaderText}>{w}</Text>)}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            const dayEvents = eventsOnDay(events, day);
            const inMonth = day.getMonth() === month;
            const isToday = isSameDay(day, today);
            return (
              <Pressable key={di} style={styles.dayCell} onPress={() => onSelectDay(day)}>
                <View style={[styles.dayNumberBadge, isToday && styles.dayNumberBadgeToday]}>
                  <Text style={[styles.dayNumberText, !inMonth && styles.dayNumberTextDim, isToday && styles.dayNumberTextToday]}>
                    {day.getDate()}
                  </Text>
                </View>
                <View style={styles.dotsRow}>
                  {dayEvents.slice(0, MAX_DOTS).map(ev => (
                    <Pressable key={ev.id} onPress={() => onSelectEvent(ev)} hitSlop={4}>
                      <View style={[styles.dot, { backgroundColor: kategorieMeta(ev.kategorie).color }]} />
                    </Pressable>
                  ))}
                  {dayEvents.length > MAX_DOTS && <Text style={styles.moreText}>+{dayEvents.length - MAX_DOTS}</Text>}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    weekHeaderRow: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderBottomWidth: 1, borderBottomColor: colors.border },
    weekHeaderText: { flex: 1, textAlign: 'center', paddingVertical: 6, fontFamily: font.semiBold, fontSize: 11, color: colors.textMuted },
    weekRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
    dayCell: {
      flex: 1, minHeight: 56, paddingVertical: 4, paddingHorizontal: 2,
      borderRightWidth: 1, borderRightColor: colors.border, alignItems: 'center',
    },
    dayNumberBadge: { width: 22, height: 22, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
    dayNumberBadgeToday: { backgroundColor: colors.primary600 },
    dayNumberText: { fontFamily: font.medium, fontSize: 12, color: colors.text },
    dayNumberTextDim: { color: colors.textFaint },
    dayNumberTextToday: { color: '#fff', fontFamily: font.bold },
    dotsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 4, justifyContent: 'center' },
    dot: { width: 6, height: 6, borderRadius: 3 },
    moreText: { fontSize: 9, color: colors.textFaint, fontFamily: font.medium },
  });
}
