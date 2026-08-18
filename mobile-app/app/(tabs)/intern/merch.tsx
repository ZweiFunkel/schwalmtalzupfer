import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, ActivityIndicator, ScrollView, Linking } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { ensureNoteAvailable } from '../../../lib/notenCache';
import { font, radius, spacing, type ColorTokens } from '../../../lib/theme';
import { useAppTheme } from '../../../lib/ThemeContext';

const BESTELLFORMULAR_KEY = 'Downloads/Bestellformular-Schwalmtalzupfer.jpg';
const MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=Hubertusplatz+21+41334+Nettetal';

export default function MerchScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureNoteAvailable(BESTELLFORMULAR_KEY)
      .then(uri => { if (!cancelled) setLocalUri(uri); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Bestellformular konnte nicht geladen werden'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const share = useCallback(async () => {
    if (localUri && await Sharing.isAvailableAsync()) {
      Sharing.shareAsync(localUri, { dialogTitle: 'Bestellformular' }).catch(() => {});
    }
  }, [localUri]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>👕 Merch</Text>
      <Text style={styles.subheading}>Vereinskleidung & Fanartikel der Schwalmtalzupfer</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bezugsquelle</Text>
        <View style={styles.card}>
          <Text style={styles.shopName}>Golden Goal Sport & Flock</Text>
          <Text style={styles.shopAddress}>Hubertusplatz 21{'\n'}41334 Nettetal</Text>
          <Pressable style={styles.linkRow} onPress={() => Linking.openURL('https://www.golden-goal.net')}>
            <Ionicons name="globe-outline" size={16} color={colors.primary700} />
            <Text style={styles.linkText}>www.golden-goal.net</Text>
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => Linking.openURL(MAPS_URL)}>
            <Ionicons name="navigate-outline" size={16} color={colors.primary700} />
            <Text style={styles.linkText}>In Maps öffnen</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bestellformular</Text>
        <Text style={styles.hint}>Bitte ausgefüllt beim Vorstand abgeben oder direkt bei Golden Goal einreichen.</Text>
        <View style={styles.formCard}>
          {loading ? (
            <ActivityIndicator color={colors.primary600} style={{ paddingVertical: spacing.xl }} />
          ) : error || !localUri ? (
            <Text style={styles.error}>{error ?? 'Formular nicht verfügbar'}</Text>
          ) : (
            <Image source={{ uri: localUri }} style={styles.formImage} resizeMode="contain" />
          )}
        </View>
        <Pressable style={styles.button} onPress={share} disabled={!localUri}>
          <Ionicons name="share-outline" size={18} color="#fff" />
          <Text style={styles.buttonText}>Teilen / Herunterladen</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surfaceMuted },
    content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
    heading: { fontSize: 24, fontFamily: font.bold, color: colors.text },
    subheading: { fontSize: 14, fontFamily: font.regular, color: colors.textMuted, marginTop: 4 },
    section: { marginTop: spacing.lg },
    sectionTitle: { fontSize: 12, fontFamily: font.semiBold, textTransform: 'uppercase', color: colors.textFaint, marginBottom: spacing.sm, letterSpacing: 0.5 },
    card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.xs },
    shopName: { fontFamily: font.bold, fontSize: 16, color: colors.text },
    shopAddress: { fontFamily: font.regular, fontSize: 14, color: colors.textMuted, marginBottom: spacing.xs },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    linkText: { fontFamily: font.medium, fontSize: 14, color: colors.primary700 },
    hint: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm },
    formCard: {
      backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
      minHeight: 200, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    formImage: { width: '100%', height: 400 },
    error: { color: colors.danger, fontFamily: font.medium, padding: spacing.lg, textAlign: 'center' },
    button: {
      flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs,
      backgroundColor: colors.primary600, borderRadius: radius.md, padding: 14, marginTop: spacing.md,
    },
    buttonText: { color: '#fff', fontSize: 15, fontFamily: font.semiBold },
  });
}
