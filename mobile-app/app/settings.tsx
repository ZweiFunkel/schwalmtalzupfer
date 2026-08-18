import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import type { Directory } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useAppTheme, type ThemeMode } from '../lib/ThemeContext';
import {
  getNotenDir, defaultNotenDir, prettyDirLabel, pickNotenDir,
  setCustomNotenDir, resetNotenDirToDefault, listCachedNoten, moveCachedNotesToCurrentDir,
} from '../lib/notenCache';
import { fetchBenachrichtigungen, updateBenachrichtigungen } from '../lib/kalender';
import { font, radius, spacing, type ColorTokens } from '../lib/theme';

type NotifKey = 'konzerte' | 'freizeiten' | 'unterrichtErinnerung';

/**
 * Bestmögliche Push-Registrierung: fragt Berechtigung an (falls noch unbekannt) und holt den
 * Expo-Push-Token. Schlägt bei fehlender Berechtigung oder fehlendem EAS-Projekt lautlos fehl -
 * blockiert nie den Rest der App.
 */
async function registerForPushNotifications(): Promise<string | null> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch {
    return null;
  }
}

const MODE_OPTIONS: Array<{ key: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { key: 'light', label: 'Hell', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dunkel', icon: 'moon-outline' },
];

export default function SettingsScreen() {
  const { colors, mode, setMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [localDir, setLocalDir] = useState<Directory | null>(null);
  const [changingDir, setChangingDir] = useState(false);

  const [notifLoaded, setNotifLoaded] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [konzerte, setKonzerte] = useState(true);
  const [freizeiten, setFreizeiten] = useState(true);
  const [unterrichtErinnerung, setUnterrichtErinnerung] = useState(false);
  const [savingNotif, setSavingNotif] = useState<NotifKey | null>(null);

  const refreshLocalDir = useCallback(async () => {
    setLocalDir(await getNotenDir());
  }, []);

  useEffect(() => { refreshLocalDir(); }, [refreshLocalDir]);

  const isDefaultDir = !localDir || localDir.uri === defaultNotenDir().uri;

  // Wechselt den lokalen Speicherort. Liegen dort schon heruntergeladene Noten, wird gefragt, ob sie
  // mitverschoben werden sollen - bei "Nein" bleiben sie am alten Ort liegen und bleiben dort nutzbar
  // (listCachedNoten()/getCachedUri() prüfen die zum Downloadzeitpunkt gespeicherte URI, nicht den
  // aktuell konfigurierten Ordner), es werden nur neue Downloads künftig am neuen Ort gespeichert.
  async function applyDirChange(newDir: Directory, persist: () => Promise<void>) {
    if (localDir && newDir.uri === localDir.uri) return;
    const cached = await listCachedNoten();
    const affected = localDir ? cached.filter(n => n.uri.startsWith(localDir.uri)) : [];

    if (affected.length === 0) {
      await persist();
      await refreshLocalDir();
      return;
    }

    Alert.alert(
      'Bestehende Noten verschieben?',
      `${affected.length} bereits heruntergeladene Note${affected.length === 1 ? '' : 'n'} liegen noch im bisherigen Ordner. In den neuen Ordner verschieben?`,
      [
        { text: 'Am alten Ort lassen', style: 'cancel', onPress: async () => { await persist(); await refreshLocalDir(); } },
        {
          text: 'Verschieben',
          onPress: async () => {
            await persist();
            const moved = await moveCachedNotesToCurrentDir(affected.map(n => n.key));
            await refreshLocalDir();
            Alert.alert('Verschoben', `${moved} Note${moved === 1 ? '' : 'n'} wurden in den neuen Ordner verschoben.`);
          },
        },
      ]
    );
  }

  async function chooseFolder() {
    setChangingDir(true);
    try {
      const dir = await pickNotenDir();
      if (dir) await applyDirChange(dir, () => setCustomNotenDir(dir));
    } catch (e) {
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Ordner konnte nicht gewählt werden');
    } finally {
      setChangingDir(false);
    }
  }

  async function resetFolder() {
    setChangingDir(true);
    try {
      await applyDirChange(defaultNotenDir(), () => resetNotenDirToDefault());
    } finally {
      setChangingDir(false);
    }
  }

  useEffect(() => {
    fetchBenachrichtigungen()
      .then(data => {
        setKonzerte(data.konzerte);
        setFreizeiten(data.freizeiten);
        setUnterrichtErinnerung(data.unterrichtErinnerung);
        setNotifLoaded(true);
      })
      .catch(e => setNotifError(e instanceof Error ? e.message : 'Einstellungen konnten nicht geladen werden'));
  }, []);

  // Push-Token bestmöglich im Hintergrund registrieren - kein Blocken, kein Alert bei Ablehnung.
  useEffect(() => {
    registerForPushNotifications().then(token => {
      if (token) updateBenachrichtigungen({ pushToken: token }).catch(() => {});
    });
  }, []);

  // Toggles speichern sofort (kein separater Speichern-Button nötig, kein Risiko eines
  // halb ausgefüllten Werts wie bei Textfeldern) - bei Fehler wird der alte Wert wiederhergestellt.
  const toggleNotif = useCallback(async (key: NotifKey, value: boolean) => {
    const setters: Record<NotifKey, (v: boolean) => void> = {
      konzerte: setKonzerte,
      freizeiten: setFreizeiten,
      unterrichtErinnerung: setUnterrichtErinnerung,
    };
    setters[key](value);
    setSavingNotif(key);
    try {
      await updateBenachrichtigungen({ [key]: value });
    } catch {
      setters[key](!value);
      Alert.alert('Fehler', 'Einstellung konnte nicht gespeichert werden.');
    } finally {
      setSavingNotif(null);
    }
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: 'Einstellungen',
          headerShown: true,
          presentation: 'modal',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: font.semiBold, color: colors.text },
          headerShadowVisible: false,
        }}
      />

      <Text style={styles.sectionTitle}>Design</Text>
      <View style={styles.segmented}>
        {MODE_OPTIONS.map(opt => (
          <Pressable
            key={opt.key}
            style={[styles.segment, mode === opt.key && styles.segmentActive]}
            onPress={() => setMode(opt.key)}
          >
            <Ionicons name={opt.icon} size={18} color={mode === opt.key ? '#fff' : colors.textMuted} />
            <Text style={[styles.segmentText, mode === opt.key && styles.segmentTextActive]}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>„System“ folgt automatisch der Geräte-Einstellung.</Text>

      <Text style={styles.sectionTitle}>Noten</Text>

      <Text style={styles.label}>Lokaler Speicherort</Text>
      <Text style={styles.hint}>
        Ordner auf diesem Gerät, in dem heruntergeladene Noten gespeichert werden (für den Offline-Zugriff).
      </Text>
      <View style={styles.pathBox}>
        <Ionicons name="folder-outline" size={16} color={colors.textMuted} />
        <Text style={styles.pathText} numberOfLines={2} ellipsizeMode="middle">
          {localDir ? prettyDirLabel(localDir) : '…'}
        </Text>
      </View>
      <View style={styles.dirButtonRow}>
        <Pressable style={styles.dirButton} onPress={chooseFolder} disabled={changingDir}>
          {changingDir ? <ActivityIndicator size="small" color={colors.primary700} /> : (
            <Text style={styles.dirButtonText}>Ordner wählen</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.dirButtonOutline, isDefaultDir && styles.saveButtonDisabled]}
          onPress={resetFolder}
          disabled={changingDir || isDefaultDir}
        >
          <Text style={styles.dirButtonOutlineText}>Auf Standard zurücksetzen</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Bereits heruntergeladene Noten bleiben unabhängig vom gewählten Ordner nutzbar.</Text>

      <Text style={styles.sectionTitle}>Benachrichtigungen</Text>
      {notifError && <Text style={styles.hint}>{notifError}</Text>}

      <View style={styles.notifRow}>
        <View style={styles.notifLabelBox}>
          <Text style={styles.notifLabel}>Konzerte</Text>
          <Text style={styles.hint}>Erinnerung vor Konzertterminen.</Text>
        </View>
        {savingNotif === 'konzerte' ? (
          <ActivityIndicator color={colors.primary600} />
        ) : (
          <Switch
            value={konzerte}
            onValueChange={v => toggleNotif('konzerte', v)}
            trackColor={{ true: colors.primary600 }}
            disabled={!notifLoaded}
          />
        )}
      </View>

      <View style={styles.notifRow}>
        <View style={styles.notifLabelBox}>
          <Text style={styles.notifLabel}>Freizeiten</Text>
          <Text style={styles.hint}>Erinnerung vor Ausflügen und Freizeiten.</Text>
        </View>
        {savingNotif === 'freizeiten' ? (
          <ActivityIndicator color={colors.primary600} />
        ) : (
          <Switch
            value={freizeiten}
            onValueChange={v => toggleNotif('freizeiten', v)}
            trackColor={{ true: colors.primary600 }}
            disabled={!notifLoaded}
          />
        )}
      </View>

      <View style={styles.notifRow}>
        <View style={styles.notifLabelBox}>
          <Text style={styles.notifLabel}>Unterrichts-Erinnerung</Text>
          <Text style={styles.hint}>Erinnerung vor der eigenen wöchentlichen Unterrichtsstunde.</Text>
        </View>
        {savingNotif === 'unterrichtErinnerung' ? (
          <ActivityIndicator color={colors.primary600} />
        ) : (
          <Switch
            value={unterrichtErinnerung}
            onValueChange={v => toggleNotif('unterrichtErinnerung', v)}
            trackColor={{ true: colors.primary600 }}
            disabled={!notifLoaded}
          />
        )}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
    sectionTitle: {
      fontSize: 12, fontFamily: font.semiBold, textTransform: 'uppercase',
      color: colors.textFaint, letterSpacing: 0.5, marginTop: spacing.lg, marginBottom: spacing.sm,
    },
    segmented: {
      flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.md,
      padding: 4, gap: 4,
    },
    segment: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 10, borderRadius: radius.sm,
    },
    segmentActive: { backgroundColor: colors.primary600 },
    segmentText: { fontFamily: font.medium, fontSize: 13, color: colors.textMuted },
    segmentTextActive: { color: '#fff', fontFamily: font.semiBold },
    hint: { fontFamily: font.regular, fontSize: 12, color: colors.textFaint, marginTop: spacing.sm },
    label: { fontFamily: font.medium, fontSize: 14, color: colors.text, marginTop: spacing.md },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
      paddingHorizontal: spacing.md, paddingVertical: 10, marginTop: spacing.sm,
      fontFamily: font.regular, fontSize: 15, color: colors.text, backgroundColor: colors.surface,
    },
    saveButton: {
      backgroundColor: colors.primary600, borderRadius: radius.md, paddingVertical: 12,
      alignItems: 'center', marginTop: spacing.md,
    },
    saveButtonDisabled: { opacity: 0.4 },
    saveButtonText: { color: '#fff', fontFamily: font.semiBold, fontSize: 15 },
    pathBox: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
      paddingHorizontal: spacing.md, paddingVertical: 10, marginTop: spacing.sm,
      backgroundColor: colors.surface,
    },
    pathText: { flex: 1, fontFamily: font.regular, fontSize: 13, color: colors.text },
    dirButtonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    dirButton: {
      flex: 1, backgroundColor: colors.primary600, borderRadius: radius.md,
      paddingVertical: 10, alignItems: 'center',
    },
    dirButtonText: { color: '#fff', fontFamily: font.semiBold, fontSize: 13 },
    dirButtonOutline: {
      flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
      paddingVertical: 10, alignItems: 'center',
    },
    dirButtonOutlineText: { color: colors.textMuted, fontFamily: font.semiBold, fontSize: 13 },
    notifRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      gap: spacing.md, paddingVertical: spacing.sm,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    notifLabelBox: { flex: 1 },
    notifLabel: { fontFamily: font.medium, fontSize: 15, color: colors.text },
  });
}
