import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView, Linking, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as ExpoLinking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { fetchMe, logout, MemberProfile } from '../../lib/auth';
import { fetchPaymentStatus, createBillingPortalSession, retrySubscription, PaymentStatus } from '../../lib/payment';
import { font, radius, spacing, type ColorTokens } from '../../lib/theme';
import { useAppTheme } from '../../lib/ThemeContext';

function paymentStatusColor(colors: ColorTokens): Record<PaymentStatus['status'], string> {
  return {
    ACTIVE: colors.primary700,
    PAST_DUE: '#a16207',
    CANCELLED: colors.danger,
    SETUP_AUSSTEHEND: '#a16207',
    KEIN_VERTRAG: colors.textFaint,
  };
}

const PAYMENT_STATUS_LABEL: Record<PaymentStatus['status'], string> = {
  ACTIVE: 'Aktiv',
  PAST_DUE: 'Zahlung ausstehend',
  CANCELLED: 'Gekündigt',
  SETUP_AUSSTEHEND: 'Zahlungseinrichtung unvollständig',
  KEIN_VERTRAG: 'Kein Vertrag hinterlegt',
};

function initialsOf(profile: MemberProfile): string {
  const a = profile.vorname?.[0] ?? '';
  const b = profile.nachname?.[0] ?? '';
  return (a + b).toUpperCase() || '?';
}

export default function ProfilScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const PAYMENT_STATUS_COLOR = useMemo(() => paymentStatusColor(colors), [colors]);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [retryLoading, setRetryLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchMe().then(setProfile).finally(() => setLoading(false));
      fetchPaymentStatus().then(setPaymentStatus).catch(() => setPaymentStatus(null));
    }, [])
  );

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  async function handleManagePayment() {
    setPortalLoading(true);
    try {
      const returnUrl = ExpoLinking.createURL('/profil');
      const url = await createBillingPortalSession(returnUrl);
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Zahlungsportal konnte nicht geöffnet werden');
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleRetrySubscription() {
    setRetryLoading(true);
    try {
      const status = await retrySubscription();
      setPaymentStatus(status);
      Alert.alert('Erledigt', 'Zahlungseinrichtung abgeschlossen.');
    } catch (e) {
      Alert.alert('Noch nicht möglich', e instanceof Error ? e.message : 'Zahlungseinrichtung konnte nicht abgeschlossen werden');
    } finally {
      setRetryLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary600} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Profil konnte nicht geladen werden.</Text>
        <Pressable style={styles.button} onPress={handleLogout}>
          <Text style={styles.buttonText}>Erneut anmelden</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsOf(profile)}</Text>
        </View>
        <Text style={styles.name}>{profile.vorname} {profile.nachname}</Text>
        <Text style={styles.email}>{profile.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{profile.role.replace('ROLE_', '')}</Text>
        </View>
      </View>

      {profile.gruppe && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gitarrengruppe</Text>
          <View style={styles.sectionCard}>
            {profile.gruppe.wochentag && (
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
                <Text style={styles.infoText}>{profile.gruppe.wochentag}</Text>
              </View>
            )}
            {profile.gruppe.vonUhrzeit && profile.gruppe.bisUhrzeit && (
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={18} color={colors.textMuted} />
                <Text style={styles.infoText}>{profile.gruppe.vonUhrzeit} – {profile.gruppe.bisUhrzeit}</Text>
              </View>
            )}
            {profile.gruppe.location?.name && (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={18} color={colors.textMuted} />
                <Text style={styles.infoText}>{profile.gruppe.location.name}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {paymentStatus && paymentStatus.status !== 'KEIN_VERTRAG' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mitgliedsbeitrag</Text>
          <View style={styles.sectionCard}>
            <View style={styles.infoRow}>
              <Ionicons name="card-outline" size={18} color={colors.textMuted} />
              <Text style={[styles.infoText, { color: PAYMENT_STATUS_COLOR[paymentStatus.status] }]}>
                {PAYMENT_STATUS_LABEL[paymentStatus.status]}
              </Text>
            </View>
            {paymentStatus.amountCents !== undefined && (
              <View style={styles.infoRow}>
                <Ionicons name="pricetag-outline" size={18} color={colors.textMuted} />
                <Text style={styles.infoText}>{(paymentStatus.amountCents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} / Monat</Text>
              </View>
            )}
          </View>
          <Pressable style={styles.portalButton} onPress={handleManagePayment} disabled={portalLoading}>
            {portalLoading
              ? <ActivityIndicator color={colors.primary700} />
              : <Text style={styles.portalButtonText}>Zahlungsart verwalten</Text>}
          </Pressable>
          {paymentStatus.status === 'SETUP_AUSSTEHEND' && (
            <>
              <Text style={styles.hint}>Nachdem du eine Zahlungsart hinterlegt hast, hier fortfahren:</Text>
              <Pressable style={styles.button} onPress={handleRetrySubscription} disabled={retryLoading}>
                {retryLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.buttonText}>Zahlungseinrichtung abschließen</Text>}
              </Pressable>
            </>
          )}
        </View>
      )}

      <Pressable style={styles.settingsRow} onPress={() => router.push('/settings')}>
        <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
        <Text style={styles.settingsRowText}>Einstellungen</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </Pressable>

      <Pressable style={[styles.button, styles.logoutButton]} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color="#fff" />
        <Text style={styles.buttonText}>Abmelden</Text>
      </Pressable>
    </ScrollView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  avatar: {
    width: 72, height: 72, borderRadius: radius.full,
    backgroundColor: colors.primary50, justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { fontFamily: font.bold, fontSize: 26, color: colors.primary700 },
  name: { fontSize: 21, fontFamily: font.bold, color: colors.text },
  email: { fontSize: 14, fontFamily: font.regular, color: colors.textMuted, marginTop: 2 },
  roleBadge: { backgroundColor: colors.primary50, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4, marginTop: spacing.sm },
  roleText: { fontFamily: font.semiBold, fontSize: 12, color: colors.primary700, textTransform: 'uppercase' },
  section: { marginTop: spacing.md },
  sectionTitle: { fontSize: 12, fontFamily: font.semiBold, textTransform: 'uppercase', color: colors.textFaint, marginBottom: spacing.sm, letterSpacing: 0.5 },
  sectionCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoText: { fontFamily: font.regular, fontSize: 15, color: colors.text },
  button: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.primary600, borderRadius: radius.md, padding: 14, marginTop: spacing.lg },
  logoutButton: { backgroundColor: colors.danger },
  buttonText: { color: '#fff', fontSize: 16, fontFamily: font.semiBold },
  errorText: { color: colors.danger, marginBottom: spacing.sm, textAlign: 'center', fontFamily: font.medium },
  portalButton: { marginTop: spacing.sm, backgroundColor: colors.primary50, borderRadius: radius.md, padding: 12, alignItems: 'center' },
  portalButtonText: { color: colors.primary700, fontFamily: font.semiBold, fontSize: 14 },
  hint: { fontFamily: font.regular, fontSize: 12, color: colors.textFaint, marginTop: spacing.sm, textAlign: 'center' },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginTop: spacing.lg,
  },
  settingsRowText: { flex: 1, fontFamily: font.medium, fontSize: 15, color: colors.text },
  });
}
