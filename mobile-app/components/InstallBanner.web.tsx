import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { font, radius, spacing, type ColorTokens } from '../lib/theme';
import { useAppTheme } from '../lib/ThemeContext';

const DISMISS_KEY = 'zupfer-install-dismissed';
const REPEAT_AFTER_MS = 14 * 24 * 3600 * 1000;

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Chrome/Edge/Android feuern beforeinstallprompt nur einmal und früh - das Event wird deshalb schon beim
// Laden des Moduls aufgefangen und für den Banner aufbewahrt.
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferred = e as InstallPromptEvent;
  notify();
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  notify();
});

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isMobile(): boolean {
  return isIos() || /Android/i.test(navigator.userAgent);
}

function recentlyDismissed(): boolean {
  try {
    return Date.now() - Number(window.localStorage.getItem(DISMISS_KEY) || 0) < REPEAT_AFTER_MS;
  } catch {
    return false;
  }
}

export default function InstallBanner() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [, force] = useState(0);
  const [hidden, setHidden] = useState(recentlyDismissed);

  useEffect(() => {
    const l = () => force(n => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  if (hidden || isStandalone()) return null;
  const canPrompt = !!deferred;
  const ios = isIos();
  // Desktop-Browser ohne Install-Angebot: nichts Sinnvolles zu sagen.
  if (!canPrompt && !ios && !isMobile()) return null;

  function dismiss() {
    setHidden(true);
    try { window.localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* privater Modus */ }
  }

  async function install() {
    if (!deferred) return;
    const event = deferred;
    deferred = null;
    await event.prompt();
    const { outcome } = await event.userChoice;
    notify();
    if (outcome === 'accepted') dismiss();
  }

  return (
    <View style={styles.banner}>
      <Image source={{ uri: '/app/icons/icon-192.png' }} style={styles.icon} />
      <View style={styles.body}>
        <Text style={styles.title}>Als App installieren</Text>
        {canPrompt ? (
          <Text style={styles.text}>Schneller Zugriff vom Startbildschirm, auch ohne Internet für heruntergeladene Noten.</Text>
        ) : ios ? (
          <View>
            <Text style={styles.text}>1. In Safari unten auf „Teilen“ tippen</Text>
            <Text style={styles.text}>2. „Zum Home-Bildschirm“ wählen</Text>
            <Text style={styles.text}>3. „Hinzufügen“ tippen und die App von dort öffnen</Text>
          </View>
        ) : (
          <Text style={styles.text}>Im Browser-Menü „App installieren“ oder „Zum Startbildschirm“ wählen.</Text>
        )}
        {canPrompt && (
          <Pressable style={styles.button} onPress={install}>
            <Text style={styles.buttonText}>Installieren</Text>
          </Pressable>
        )}
      </View>
      <Pressable hitSlop={8} onPress={dismiss} accessibilityLabel="Später">
        <Ionicons name="close" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: spacing.md,
    },
    icon: { width: 44, height: 44, borderRadius: radius.md },
    body: { flex: 1, gap: 2 },
    title: { fontFamily: font.semiBold, fontSize: 15, color: colors.text },
    text: { fontFamily: font.regular, fontSize: 13, color: colors.textMuted },
    button: {
      alignSelf: 'flex-start',
      marginTop: spacing.xs,
      backgroundColor: colors.primary600,
      borderRadius: radius.md,
      paddingVertical: 8,
      paddingHorizontal: spacing.md,
    },
    buttonText: { color: '#fff', fontFamily: font.semiBold, fontSize: 13 },
  });
}
