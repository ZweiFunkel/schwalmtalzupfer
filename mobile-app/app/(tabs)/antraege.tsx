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
  Modal,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchAntraege, updateAntrag, deleteAntrag, MembershipApplication } from '../../lib/beitritt';
import { fetchGruppen, Gruppe } from '../../lib/gruppen';
import { font, radius, spacing, type ColorTokens } from '../../lib/theme';
import { useAppTheme } from '../../lib/ThemeContext';

const STATUS_FILTERS: Array<{ key: 'ALLE' | MembershipApplication['status']; label: string }> = [
  { key: 'ALLE', label: 'Alle' },
  { key: 'NEU', label: 'Neu' },
  { key: 'IN_KONTAKT', label: 'In Kontakt' },
  { key: 'ANGENOMMEN', label: 'Angenommen' },
  { key: 'ABGELEHNT', label: 'Abgelehnt' },
];

const STATUS_LABEL: Record<MembershipApplication['status'], string> = {
  NEU: 'Neu',
  IN_KONTAKT: 'In Kontakt',
  ANGENOMMEN: 'Angenommen',
  ABGELEHNT: 'Abgelehnt',
};

function statusColor(colors: ColorTokens): Record<MembershipApplication['status'], string> {
  return {
    NEU: '#1d4ed8',
    IN_KONTAKT: '#a16207',
    ANGENOMMEN: colors.primary700,
    ABGELEHNT: colors.danger,
  };
}

export default function AntraegeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const STATUS_COLOR = useMemo(() => statusColor(colors), [colors]);
  const [antraege, setAntraege] = useState<MembershipApplication[]>([]);
  const [gruppen, setGruppen] = useState<Gruppe[]>([]);
  const [filter, setFilter] = useState<'ALLE' | MembershipApplication['status']>('ALLE');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerForId, setPickerForId] = useState<string | null>(null);
  const [notizDraft, setNotizDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [apps, gr] = await Promise.all([
        fetchAntraege(filter === 'ALLE' ? undefined : filter),
        fetchGruppen(),
      ]);
      setAntraege(apps);
      setGruppen(gr);
    } catch {
      // Liste bleibt leer, Fehler ist nicht kritisch für die Ansicht
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  async function assignGruppe(id: string, gruppeId: string) {
    setPickerForId(null);
    try {
      await updateAntrag(id, { gitarrengruppeId: gruppeId });
      load();
    } catch (e) {
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Zuweisung fehlgeschlagen');
    }
  }

  async function saveNotiz(id: string) {
    const notiz = notizDraft[id];
    if (notiz === undefined) return;
    try {
      await updateAntrag(id, { boardNotiz: notiz });
    } catch (e) {
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Notiz konnte nicht gespeichert werden');
    }
  }

  async function setStatus(id: string, status: 'IN_KONTAKT' | 'ABGELEHNT') {
    try {
      await updateAntrag(id, { status });
      load();
    } catch (e) {
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Status konnte nicht geändert werden');
    }
  }

  function confirmReject(id: string) {
    Alert.alert('Antrag ablehnen?', 'Diese Aktion kann nicht rückgängig gemacht werden.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Ablehnen', style: 'destructive', onPress: () => setStatus(id, 'ABGELEHNT') },
    ]);
  }

  function confirmDelete(id: string) {
    Alert.alert('Antrag löschen?', 'Das kann nicht rückgängig gemacht werden.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAntrag(id);
            load();
          } catch (e) {
            Alert.alert('Fehler', e instanceof Error ? e.message : 'Löschen fehlgeschlagen');
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        data={STATUS_FILTERS}
        keyExtractor={f => f.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.filterChip, filter === item.key && styles.filterChipActive]}
            onPress={() => setFilter(item.key)}
          >
            <Text style={[styles.filterChipText, filter === item.key && styles.filterChipTextActive]}>{item.label}</Text>
          </Pressable>
        )}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary600} />
        </View>
      ) : (
        <FlatList
          data={antraege}
          keyExtractor={a => a.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary600} />}
          ListEmptyComponent={<Text style={styles.empty}>Keine Anträge in dieser Ansicht.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {item.antragstellerVorname} {item.antragstellerNachname}
                  </Text>
                  {item.fuerKind && (
                    <Text style={styles.subtext}>für Kind: {item.kindVorname} {item.kindNachname}</Text>
                  )}
                  <Text style={styles.subtext}>{item.email}{item.telefon ? ` · ${item.telefon}` : ''}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + '22' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>{STATUS_LABEL[item.status]}</Text>
                </View>
              </View>

              {(item.alterJahre || item.gitarrenErfahrung) && (
                <Text style={styles.info}>
                  {item.alterJahre ? `${item.alterJahre} Jahre` : ''}
                  {item.alterJahre && item.gitarrenErfahrung ? ' · ' : ''}
                  {item.gitarrenErfahrung ?? ''}
                </Text>
              )}

              <Pressable style={styles.gruppeButton} onPress={() => setPickerForId(item.id)}>
                <Ionicons name="people-outline" size={16} color={colors.primary700} />
                <Text style={styles.gruppeButtonText}>
                  {item.gitarrengruppe ? `${item.gitarrengruppe.wochentag} ${item.gitarrengruppe.vonUhrzeit}–${item.gitarrengruppe.bisUhrzeit}` : 'Gruppe zuweisen'}
                </Text>
              </Pressable>

              <TextInput
                style={styles.notizInput}
                placeholder="Vorstands-Notiz"
                placeholderTextColor={colors.textFaint}
                defaultValue={item.boardNotiz ?? ''}
                onChangeText={text => setNotizDraft(prev => ({ ...prev, [item.id]: text }))}
                onBlur={() => saveNotiz(item.id)}
              />

              <View style={styles.actionRow}>
                {item.status === 'NEU' && (
                  <Pressable style={styles.actionButtonYellow} onPress={() => setStatus(item.id, 'IN_KONTAKT')}>
                    <Text style={styles.actionButtonYellowText}>Kontakt aufgenommen</Text>
                  </Pressable>
                )}
                {item.status !== 'ABGELEHNT' && item.status !== 'ANGENOMMEN' && (
                  <Pressable style={styles.actionButtonRed} onPress={() => confirmReject(item.id)}>
                    <Text style={styles.actionButtonRedText}>Ablehnen</Text>
                  </Pressable>
                )}
                <Pressable style={styles.actionButtonOutline} onPress={() => confirmDelete(item.id)}>
                  <Text style={styles.actionButtonOutlineText}>Löschen</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={pickerForId !== null} animationType="slide" transparent onRequestClose={() => setPickerForId(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerForId(null)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Unterrichtsgruppe wählen</Text>
            <FlatList
              data={gruppen}
              keyExtractor={g => g.id}
              renderItem={({ item }) => (
                <Pressable style={styles.modalRow} onPress={() => pickerForId && assignGruppe(pickerForId, item.id)}>
                  <Text style={styles.modalRowText}>{item.wochentag} {item.vonUhrzeit}–{item.bisUhrzeit}</Text>
                  {item.location?.name && <Text style={styles.modalRowSub}>{item.location.name}</Text>}
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.empty}>Keine Gruppen vorhanden.</Text>}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceMuted },
  filterRow: { padding: spacing.md, gap: spacing.sm, alignItems: 'center' },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm },
  filterChipActive: { backgroundColor: colors.primary600, borderColor: colors.primary600 },
  filterChipText: { fontFamily: font.medium, fontSize: 13, color: colors.textMuted },
  filterChipTextActive: { color: '#fff' },
  listContent: { padding: spacing.md, paddingTop: 0 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  name: { fontFamily: font.bold, fontSize: 16, color: colors.text },
  subtext: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  info: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted, marginTop: spacing.sm },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  statusText: { fontFamily: font.semiBold, fontSize: 11 },
  gruppeButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, alignSelf: 'flex-start', backgroundColor: colors.primary50, paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radius.sm },
  gruppeButtonText: { fontFamily: font.medium, fontSize: 13, color: colors.primary700 },
  notizInput: { marginTop: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 8, fontFamily: font.regular, fontSize: 13, color: colors.text },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionButtonYellow: { backgroundColor: '#fef3c7', paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radius.sm },
  actionButtonYellowText: { color: '#92400e', fontFamily: font.semiBold, fontSize: 12 },
  actionButtonRed: { backgroundColor: colors.dangerMuted, paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radius.sm },
  actionButtonRedText: { color: colors.danger, fontFamily: font.semiBold, fontSize: 12 },
  actionButtonOutline: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radius.sm },
  actionButtonOutlineText: { color: colors.textMuted, fontFamily: font.semiBold, fontSize: 12 },
  empty: { textAlign: 'center', color: colors.textFaint, fontFamily: font.regular, marginTop: spacing.xl, padding: spacing.md },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, maxHeight: '60%' },
  modalTitle: { fontFamily: font.bold, fontSize: 16, color: colors.text, marginBottom: spacing.sm },
  modalRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalRowText: { fontFamily: font.medium, fontSize: 15, color: colors.text },
  modalRowSub: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted },
  });
}
