import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Image, Pressable, StyleSheet, ActivityIndicator, FlatList,
  Modal, Dimensions, useWindowDimensions,
} from 'react-native';
import { useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  browseGalerieIntern, thumbnailUrl, absoluteApiUrl, GALERIE_INTERN_ROOT,
  type GalerieBrowseResult, type GalerieImage,
} from '../../../lib/galerieIntern';
import { getToken } from '../../../lib/auth';
import { font, radius, spacing, type ColorTokens } from '../../../lib/theme';
import { useAppTheme } from '../../../lib/ThemeContext';

function labelFor(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');
}

export default function GalerieInternScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation();
  const { width } = useWindowDimensions();

  const [stack, setStack] = useState<string[]>([GALERIE_INTERN_ROOT]);
  const prefix = stack[stack.length - 1];
  const [data, setData] = useState<GalerieBrowseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => { getToken().then(setToken); }, []);

  const load = useCallback((p: string) => {
    setLoading(true);
    setError(null);
    browseGalerieIntern(p)
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : 'Galerie konnte nicht geladen werden'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(prefix); }, [prefix, load]);

  const goBack = useCallback(() => {
    setStack(s => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: stack.length > 1 ? () => (
        <Pressable onPress={goBack} hitSlop={12} style={{ paddingHorizontal: spacing.sm }}>
          <Ionicons name="chevron-back" size={24} color={colors.primary600} />
        </Pressable>
      ) : undefined,
    });
  }, [stack.length, goBack, navigation, colors]);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;
  const columns = width >= 700 ? 4 : 3;
  const gap = spacing.sm;
  const tileSize = (width - spacing.lg * 2 - gap * (columns - 1)) / columns;

  const images = data?.images ?? [];
  const folders = data?.folders ?? [];

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary600} size="large" /></View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.textFaint} style={{ marginBottom: spacing.sm }} />
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.retry} onPress={() => load(prefix)}>
            <Text style={styles.retryText}>Erneut versuchen</Text>
          </Pressable>
        </View>
      ) : folders.length === 0 && images.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="images-outline" size={40} color={colors.textFaint} style={{ marginBottom: spacing.sm }} />
          <Text style={styles.emptyText}>Noch keine Inhalte in diesem Bereich.</Text>
        </View>
      ) : (
        <FlatList
          data={[...folders.map(f => ({ type: 'folder' as const, folder: f })), ...images.map(i => ({ type: 'image' as const, image: i }))]}
          keyExtractor={(item, idx) => (item.type === 'folder' ? item.folder.prefix : item.image.key) + idx}
          numColumns={columns}
          key={columns}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap }}
          ItemSeparatorComponent={() => <View style={{ height: gap }} />}
          renderItem={({ item }) => {
            if (item.type === 'folder') {
              const f = item.folder;
              return (
                <Pressable style={[styles.tile, { width: tileSize, height: tileSize }]} onPress={() => setStack(s => [...s, f.prefix])}>
                  {f.coverUrl ? (
                    <Image source={{ uri: absoluteApiUrl(f.coverUrl), headers: authHeaders }} style={styles.tileImage} />
                  ) : (
                    <View style={[styles.tileImage, styles.tilePlaceholder]}>
                      <Ionicons name="folder-outline" size={28} color={colors.textFaint} />
                    </View>
                  )}
                  <View style={styles.tileOverlay}>
                    <Text style={styles.tileLabel} numberOfLines={1}>{labelFor(f.name)}</Text>
                    <Text style={styles.tileCount}>{f.imageCount > 0 ? `${f.imageCount} Fotos` : f.hasSubFolders ? 'Unteralben' : 'Leer'}</Text>
                  </View>
                </Pressable>
              );
            }
            const idx = images.findIndex(i => i.key === item.image.key);
            return (
              <Pressable style={[styles.tile, { width: tileSize, height: tileSize }]} onPress={() => setLightbox(idx)}>
                <Image source={{ uri: thumbnailUrl(item.image.key), headers: authHeaders }} style={styles.tileImage} />
              </Pressable>
            );
          }}
        />
      )}

      {lightbox !== null && images[lightbox] && (
        <GalerieLightbox
          images={images}
          index={lightbox}
          authHeaders={authHeaders}
          onClose={() => setLightbox(null)}
          onIndex={setLightbox}
        />
      )}
    </View>
  );
}

function GalerieLightbox({ images, index, authHeaders, onClose, onIndex }: {
  images: GalerieImage[];
  index: number;
  authHeaders?: Record<string, string>;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const { width, height } = Dimensions.get('window');
  const current = images[index];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={lbStyles.backdrop}>
        <Pressable style={lbStyles.closeBtn} onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <Image
          source={{ uri: absoluteApiUrl(current.url), headers: authHeaders }}
          style={{ width, height: height * 0.8 }}
          resizeMode="contain"
        />
        <View style={lbStyles.navRow}>
          <Pressable
            style={[lbStyles.navBtn, index === 0 && lbStyles.navBtnDisabled]}
            onPress={() => index > 0 && onIndex(index - 1)}
            disabled={index === 0}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <Text style={lbStyles.navLabel}>{index + 1} / {images.length}</Text>
          <Pressable
            style={[lbStyles.navBtn, index === images.length - 1 && lbStyles.navBtnDisabled]}
            onPress={() => index < images.length - 1 && onIndex(index + 1)}
            disabled={index === images.length - 1}
          >
            <Ionicons name="chevron-forward" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const lbStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  closeBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.md },
  navBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  navBtnDisabled: { opacity: 0.3 },
  navLabel: { color: '#fff', fontFamily: font.medium, fontSize: 14 },
});

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surfaceMuted },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
    grid: { padding: spacing.lg },
    tile: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface },
    tileImage: { width: '100%', height: '100%' },
    tilePlaceholder: { alignItems: 'center', justifyContent: 'center' },
    tileOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 6, backgroundColor: 'rgba(0,0,0,0.55)' },
    tileLabel: { color: '#fff', fontFamily: font.semiBold, fontSize: 11 },
    tileCount: { color: 'rgba(255,255,255,0.75)', fontFamily: font.regular, fontSize: 9, marginTop: 1 },
    error: { color: colors.danger, textAlign: 'center', fontFamily: font.medium, marginBottom: spacing.sm },
    emptyText: { color: colors.textFaint, fontFamily: font.regular, textAlign: 'center' },
    retry: { marginTop: spacing.sm, backgroundColor: colors.primary600, paddingVertical: 10, paddingHorizontal: 20, borderRadius: radius.md },
    retryText: { color: '#fff', fontFamily: font.semiBold, fontSize: 14 },
  });
}
