import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { font, radius, spacing, type ColorTokens } from '../../../lib/theme';
import { useAppTheme } from '../../../lib/ThemeContext';

const CARDS: Array<{ href: '/intern/videos' | '/intern/merch' | '/intern/galerie'; icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }> = [
  { href: '/intern/videos', icon: 'film-outline', title: 'Videos', desc: 'Sommer- und Winterkonzerte sowie weitere Auftritte.' },
  { href: '/intern/merch', icon: 'shirt-outline', title: 'Merch', desc: 'Vereinskleidung & Fanartikel mit Bestellformular.' },
  { href: '/intern/galerie', icon: 'images-outline', title: 'Interne Galerie', desc: 'Fotos nur für Mitglieder - nicht öffentlich einsehbar.' },
];

export default function InternHomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Interner Bereich</Text>
      <Text style={styles.subheading}>Alles für Mitglieder an einem Ort.</Text>

      {CARDS.map(card => (
        <Pressable key={card.href} style={styles.card} onPress={() => router.push(card.href)}>
          <View style={styles.iconBadge}>
            <Ionicons name={card.icon} size={22} color={colors.primary700} />
          </View>
          <View style={styles.cardTextWrap}>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardDesc}>{card.desc}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surfaceMuted },
    content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
    heading: { fontSize: 24, fontFamily: font.bold, color: colors.text },
    subheading: { fontSize: 14, fontFamily: font.regular, color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg },
    card: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md,
      borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
    },
    iconBadge: {
      width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primary50,
      justifyContent: 'center', alignItems: 'center',
    },
    cardTextWrap: { flex: 1 },
    cardTitle: { fontFamily: font.semiBold, fontSize: 16, color: colors.text },
    cardDesc: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  });
}
