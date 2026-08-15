import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { login } from '../lib/auth';
import { colors, font, radius, spacing } from '../lib/theme';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
      router.replace('/(tabs)/noten');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <View style={styles.logo}>
          <Ionicons name="musical-notes" size={30} color={colors.primary700} />
        </View>
        <Text style={styles.title}>Schwalmtalzupfer</Text>
        <Text style={styles.subtitle}>Melde dich mit deinem Mitgliedskonto an</Text>

        <View style={styles.field}>
          <Ionicons name="person-outline" size={18} color={colors.textFaint} style={styles.fieldIcon} />
          <TextInput
            style={styles.input}
            placeholder="Benutzername oder E-Mail"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
          />
        </View>

        <View style={styles.field}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textFaint} style={styles.fieldIcon} />
          <TextInput
            style={styles.input}
            placeholder="Passwort"
            placeholderTextColor={colors.textFaint}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Anmelden</Text>}
        </Pressable>

        <Pressable style={styles.linkButton} onPress={() => router.push('/beitritt')}>
          <Text style={styles.linkText}>Noch kein Mitglied? Verein beitreten</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceMuted, padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logo: {
    alignSelf: 'center',
    width: 56, height: 56, borderRadius: radius.full,
    backgroundColor: colors.primary50, justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: { fontSize: 24, fontFamily: font.bold, marginBottom: 4, textAlign: 'center', color: colors.text },
  subtitle: { fontSize: 14, fontFamily: font.regular, color: colors.textMuted, marginBottom: spacing.lg, textAlign: 'center' },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, marginBottom: spacing.sm,
  },
  fieldIcon: { width: 20 },
  input: { flex: 1, paddingVertical: 12, fontFamily: font.regular, fontSize: 15, color: colors.text },
  button: { backgroundColor: colors.primary600, borderRadius: radius.md, padding: 14, alignItems: 'center', marginTop: spacing.sm },
  buttonText: { color: '#fff', fontSize: 16, fontFamily: font.semiBold },
  error: { color: colors.danger, marginBottom: spacing.sm, fontFamily: font.medium, textAlign: 'center' },
  linkButton: { marginTop: spacing.md, alignItems: 'center' },
  linkText: { color: colors.primary700, fontFamily: font.medium, fontSize: 14 },
});
