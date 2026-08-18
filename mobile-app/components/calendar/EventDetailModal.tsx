import { useMemo } from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { KalenderTermin } from '../../lib/kalender';
import { kategorieMeta } from '../../lib/kalenderKategorie';
import { parseIso, formatTime } from '../../lib/calendarDate';
import { font, radius, spacing, type ColorTokens } from '../../lib/theme';
import { useAppTheme } from '../../lib/ThemeContext';

export default function EventDetailModal({ event, onClose }: { event: KalenderTermin | null; onClose: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!event) return null;
  const meta = kategorieMeta(event.kategorie);

  const dateLabel = event.endDatum && event.endDatum !== event.startDatum
    ? `${parseIso(event.startDatum).toLocaleDateString('de-DE')} – ${parseIso(event.endDatum).toLocaleDateString('de-DE')}`
    : parseIso(event.startDatum).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const timeLabel = event.uhrzeitVon
    ? `${formatTime(event.uhrzeitVon)}${event.uhrzeitBis ? ` – ${formatTime(event.uhrzeitBis)}` : ''} Uhr`
    : null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <View style={styles.headerRow}>
            <View style={[styles.badge, { backgroundColor: meta.color + '22' }]}>
              <Ionicons name={meta.icon} size={14} color={meta.color} />
              <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textFaint} />
            </Pressable>
          </View>

          <Text style={styles.title}>{event.titel}</Text>

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
            <Text style={styles.infoText}>{dateLabel}{timeLabel ? `, ${timeLabel}` : ''}</Text>
          </View>
          {event.ort && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color={colors.textMuted} />
              <Text style={styles.infoText}>{event.ort}</Text>
            </View>
          )}
          {event.beschreibung && <Text style={styles.description}>{event.beschreibung}</Text>}

          {event.abgesagt && (
            <View style={styles.cancelledBox}>
              <Text style={styles.cancelledText}>
                {event.istUnterricht ? 'Kein Unterricht' : 'Abgesagt'}{event.absageGrund ? `: ${event.absageGrund}` : ''}
              </Text>
            </View>
          )}
          {event.generiert && (
            <Text style={styles.hint}>Regelmäßige Unterrichtsstunde (automatisch aus dem Gruppenplan)</Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
    sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
    badgeText: { fontFamily: font.semiBold, fontSize: 11 },
    title: { fontFamily: font.bold, fontSize: 18, color: colors.text },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    infoText: { fontFamily: font.regular, fontSize: 14, color: colors.textMuted, flexShrink: 1 },
    description: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted, marginTop: 2 },
    cancelledBox: { backgroundColor: colors.dangerMuted, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.xs },
    cancelledText: { fontFamily: font.medium, fontSize: 13, color: colors.danger },
    hint: { fontFamily: font.regular, fontSize: 12, color: colors.textFaint, marginTop: spacing.xs },
  });
}
