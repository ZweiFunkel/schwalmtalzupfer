import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView, Switch } from 'react-native';
import { router, Stack } from 'expo-router';
import { submitBeitrittsantrag } from '../lib/beitritt';
import { font, radius, spacing, type ColorTokens } from '../lib/theme';
import { useAppTheme } from '../lib/ThemeContext';

export default function BeitrittScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [antragstellerVorname, setAntragstellerVorname] = useState('');
  const [antragstellerNachname, setAntragstellerNachname] = useState('');
  const [email, setEmail] = useState('');
  const [telefon, setTelefon] = useState('');
  const [fuerKind, setFuerKind] = useState(false);
  const [kindVorname, setKindVorname] = useState('');
  const [kindNachname, setKindNachname] = useState('');
  const [alterJahre, setAlterJahre] = useState('');
  const [gitarrenErfahrung, setGitarrenErfahrung] = useState('');

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!antragstellerVorname.trim() || !antragstellerNachname.trim() || !email.trim()) {
      setError('Vorname, Nachname und E-Mail sind Pflichtfelder.');
      return;
    }
    if (fuerKind && (!kindVorname.trim() || !kindNachname.trim())) {
      setError('Vor- und Nachname des Kindes sind Pflichtfelder.');
      return;
    }
    setSending(true);
    try {
      await submitBeitrittsantrag({
        antragstellerVorname: antragstellerVorname.trim(),
        antragstellerNachname: antragstellerNachname.trim(),
        email: email.trim(),
        telefon: telefon.trim() || undefined,
        fuerKind,
        kindVorname: fuerKind ? kindVorname.trim() : undefined,
        kindNachname: fuerKind ? kindNachname.trim() : undefined,
        alterJahre: alterJahre ? Number(alterJahre) : undefined,
        gitarrenErfahrung: gitarrenErfahrung.trim() || undefined,
      });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Antrag konnte nicht gesendet werden');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Beitreten', headerShown: true }} />
        <Text style={styles.successIcon}>✓</Text>
        <Text style={styles.successTitle}>Antrag gesendet!</Text>
        <Text style={styles.hint}>Der Vorstand meldet sich in Kürze bei dir.</Text>
        <Pressable style={styles.button} onPress={() => router.replace('/login')}>
          <Text style={styles.buttonText}>Zurück zum Login</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Beitreten' }} />
      <Text style={styles.title}>Verein beitreten</Text>
      <Text style={styles.subtitle}>Der Vorstand meldet sich anschließend mit Details zu Gruppe und Beitrag.</Text>

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Vorname *</Text>
          <TextInput style={styles.input} value={antragstellerVorname} onChangeText={setAntragstellerVorname} />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Nachname *</Text>
          <TextInput style={styles.input} value={antragstellerNachname} onChangeText={setAntragstellerNachname} />
        </View>
      </View>

      <Text style={styles.label}>E-Mail *</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

      <Text style={styles.label}>Telefon (optional)</Text>
      <TextInput style={styles.input} value={telefon} onChangeText={setTelefon} keyboardType="phone-pad" />

      <View style={styles.switchRow}>
        <Switch value={fuerKind} onValueChange={setFuerKind} trackColor={{ true: colors.primary600 }} />
        <Text style={styles.switchLabel}>Der Antrag ist für mein Kind</Text>
      </View>

      {fuerKind && (
        <View style={styles.childBox}>
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Vorname Kind *</Text>
              <TextInput style={styles.input} value={kindVorname} onChangeText={setKindVorname} />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Nachname Kind *</Text>
              <TextInput style={styles.input} value={kindNachname} onChangeText={setKindNachname} />
            </View>
          </View>
        </View>
      )}

      <Text style={styles.label}>Alter (der unterrichteten Person)</Text>
      <TextInput style={styles.input} value={alterJahre} onChangeText={setAlterJahre} keyboardType="number-pad" />

      <Text style={styles.label}>Gitarrenerfahrung (optional)</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={gitarrenErfahrung}
        onChangeText={setGitarrenErfahrung}
        multiline
        numberOfLines={4}
        placeholder="z.B. keine Vorkenntnisse, 2 Jahre Unterricht, ..."
        placeholderTextColor={colors.textFaint}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={handleSubmit} disabled={sending}>
        {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Antrag senden</Text>}
      </Pressable>
    </ScrollView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.background },
  title: { fontSize: 24, fontFamily: font.bold, color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, fontFamily: font.regular, color: colors.textMuted, marginBottom: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  label: { fontSize: 13, fontFamily: font.medium, color: colors.textMuted, marginBottom: 4, marginTop: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 10, fontFamily: font.regular, fontSize: 15, color: colors.text,
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  switchLabel: { fontFamily: font.regular, fontSize: 14, color: colors.text },
  childBox: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  error: { color: colors.danger, fontFamily: font.medium, marginTop: spacing.md, textAlign: 'center' },
  button: { backgroundColor: colors.primary600, borderRadius: radius.md, padding: 14, alignItems: 'center', marginTop: spacing.lg },
  buttonText: { color: '#fff', fontSize: 16, fontFamily: font.semiBold },
  successIcon: { fontSize: 40, color: colors.primary600, marginBottom: spacing.sm },
  successTitle: { fontSize: 20, fontFamily: font.bold, color: colors.text, marginBottom: 4 },
  hint: { fontSize: 14, fontFamily: font.regular, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg },
  });
}
