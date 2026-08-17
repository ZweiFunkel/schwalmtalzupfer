import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, type ThemeMode } from '../lib/ThemeContext';
import { getNotenDefaultSubpath, setNotenDefaultSubpath } from '../lib/settings';
import { getNotenRootPrefix } from '../lib/noten';
import { font, radius, spacing, type ColorTokens } from '../lib/theme';

const MODE_OPTIONS: Array<{ key: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { key: 'light', label: 'Hell', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dunkel', icon: 'moon-outline' },
];

export default function SettingsScreen() {
  const { colors, mode, setMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [rootPrefix, setRootPrefix] = useState('');
  const [subpath, setSubpath] = useState('');
  const [savedSubpath, setSavedSubpath] = useState('');

  useEffect(() => {
    getNotenRootPrefix().then(setRootPrefix).catch(() => {});
    getNotenDefaultSubpath().then(sub => { setSubpath(sub); setSavedSubpath(sub); }).catch(() => {});
  }, []);

  async function saveSubpath() {
    await setNotenDefaultSubpath(subpath);
    setSavedSubpath(subpath.trim());
    Alert.alert('Gespeichert', subpath.trim() ? `Noten-Tab startet jetzt in „${subpath.trim()}“.` : 'Noten-Tab startet wieder im Hauptordner.');
  }

  const dirty = subpath.trim() !== savedSubpath;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Einstellungen', headerShown: true, presentation: 'modal' }} />

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
      <Text style={styles.label}>Standard-Ordner</Text>
      <Text style={styles.hint}>
        Relativ zum eingerichteten Noten-Ordner{rootPrefix ? ` („${rootPrefix}“)` : ''}. Leer lassen für den Hauptordner.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="z.B. Blasmusik/Trompete"
        placeholderTextColor={colors.textFaint}
        value={subpath}
        onChangeText={setSubpath}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable style={[styles.saveButton, !dirty && styles.saveButtonDisabled]} onPress={saveSubpath} disabled={!dirty}>
        <Text style={styles.saveButtonText}>Speichern</Text>
      </Pressable>
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
  });
}
