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
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { searchMembers, setMemberActive, Member } from '../../../lib/member';
import { font, radius, spacing, type ColorTokens } from '../../../lib/theme';
import { useAppTheme } from '../../../lib/ThemeContext';

const ROLE_LABEL: Record<string, string> = {
  GUEST: 'Gast',
  MEMBER: 'Mitglied',
  BOARD: 'Vorstand',
  CHEF: 'Chef',
  ADMIN: 'Administrator',
};

export default function MitgliederScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Debounce Suche, analog zum Web-Pendant admin/members/page.tsx
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const result = await searchMembers(debouncedSearch || undefined);
      setMembers(result);
    } catch (e) {
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Mitglieder konnten nicht geladen werden');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const filtered = useMemo(
    () => members.filter(m => (showArchive ? !m.istAktiv : m.istAktiv)),
    [members, showArchive]
  );

  async function toggleAktiv(member: Member) {
    setBusyId(member.id);
    try {
      await setMemberActive(member.id, !member.istAktiv);
      load();
    } catch (e) {
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Aktion konnte nicht durchgeführt werden');
    } finally {
      setBusyId(null);
    }
  }

  function confirmToggle(member: Member) {
    const name = displayName(member);
    if (member.istAktiv) {
      Alert.alert(
        'Mitglied deaktivieren?',
        `${name} wird ins Archiv verschoben und kann sich nicht mehr anmelden.`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Deaktivieren', style: 'destructive', onPress: () => toggleAktiv(member) },
        ]
      );
    } else {
      Alert.alert(
        'Mitglied reaktivieren?',
        `${name} wird wieder aktiviert und kann sich anmelden.`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Reaktivieren', onPress: () => toggleAktiv(member) },
        ]
      );
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <TextInput
          style={styles.searchInput}
          placeholder="Suche nach Vorname, Nachname, Username…"
          placeholderTextColor={colors.textFaint}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </Pressable>
        )}
      </View>

      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggleChip, showArchive && styles.toggleChipActive]}
          onPress={() => setShowArchive(v => !v)}
        >
          <Text style={[styles.toggleChipText, showArchive && styles.toggleChipTextActive]}>
            {showArchive ? 'Archiv anzeigen' : 'Aktive anzeigen'}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary600} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary600} />}
          ListEmptyComponent={<Text style={styles.empty}>Keine Mitglieder gefunden.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{displayName(item)}</Text>
                  {item.gruppe && (
                    <Text style={styles.subtext}>
                      {item.gruppe.wochentag} {item.gruppe.vonUhrzeit}–{item.gruppe.bisUhrzeit}
                      {item.gruppe.location?.name ? ` · ${item.gruppe.location.name}` : ''}
                    </Text>
                  )}
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: item.istAktiv ? colors.primary50 : colors.dangerMuted },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: item.istAktiv ? colors.primary700 : colors.danger },
                    ]}
                  >
                    {item.istAktiv ? 'Aktiv' : 'Archiviert'}
                  </Text>
                </View>
              </View>

              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{ROLE_LABEL[item.role] ?? item.role}</Text>
              </View>

              <Pressable
                style={item.istAktiv ? styles.actionButtonRed : styles.actionButtonGreen}
                onPress={() => confirmToggle(item)}
                disabled={busyId === item.id}
              >
                {busyId === item.id ? (
                  <ActivityIndicator size="small" color={item.istAktiv ? colors.danger : '#fff'} />
                ) : (
                  <Text style={item.istAktiv ? styles.actionButtonRedText : styles.actionButtonGreenText}>
                    {item.istAktiv ? 'Deaktivieren' : 'Reaktivieren'}
                  </Text>
                )}
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

function displayName(m: Member): string {
  const full = [m.vorname, m.nachname].filter(Boolean).join(' ').trim();
  return full || m.username || m.email || '–';
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceMuted },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 15, color: colors.text },
  toggleRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  toggleChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  toggleChipActive: { backgroundColor: colors.primary600, borderColor: colors.primary600 },
  toggleChipText: { fontFamily: font.medium, fontSize: 13, color: colors.textMuted },
  toggleChipTextActive: { color: '#fff' },
  listContent: { padding: spacing.md, paddingTop: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  name: { fontFamily: font.bold, fontSize: 16, color: colors.text },
  subtext: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  statusText: { fontFamily: font.semiBold, fontSize: 11 },
  roleBadge: { alignSelf: 'flex-start', backgroundColor: colors.surfaceMuted, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, marginTop: spacing.sm },
  roleBadgeText: { fontFamily: font.medium, fontSize: 12, color: colors.textMuted },
  actionButtonGreen: { alignSelf: 'flex-start', backgroundColor: colors.primary600, paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radius.sm, marginTop: spacing.sm, minWidth: 110, alignItems: 'center' },
  actionButtonGreenText: { color: '#fff', fontFamily: font.semiBold, fontSize: 12 },
  actionButtonRed: { alignSelf: 'flex-start', backgroundColor: colors.dangerMuted, paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radius.sm, marginTop: spacing.sm, minWidth: 110, alignItems: 'center' },
  actionButtonRedText: { color: colors.danger, fontFamily: font.semiBold, fontSize: 12 },
  empty: { textAlign: 'center', color: colors.textFaint, fontFamily: font.regular, marginTop: spacing.xl, padding: spacing.md },
  });
}
