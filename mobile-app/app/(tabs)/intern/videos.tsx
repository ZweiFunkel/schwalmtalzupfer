import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Image, Pressable, StyleSheet, ActivityIndicator, FlatList,
  Modal, useWindowDimensions, Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchVideos, thumbnailFor, buildPlayerHtml, watchUrl, buildNav,
  type VideoEntry, type NavStructure,
} from '../../../lib/videos';
import { font, radius, spacing, type ColorTokens } from '../../../lib/theme';
import { useAppTheme } from '../../../lib/ThemeContext';

type Selection =
  | { cat: 'SOMMER' | 'WINTER'; year: string; day: string | null }
  | { cat: 'WEITERE'; sub: string };

function isSel(sel: Selection | null, item: Selection): boolean {
  if (!sel || sel.cat !== item.cat) return false;
  if (sel.cat === 'WEITERE' && item.cat === 'WEITERE') return sel.sub === item.sub;
  if (sel.cat !== 'WEITERE' && item.cat !== 'WEITERE') return sel.year === item.year && sel.day === item.day;
  return false;
}

export default function VideosScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();

  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [playing, setPlaying] = useState<VideoEntry | null>(null);
  const [playerError, setPlayerError] = useState<number | null>(null);

  function openPlayer(v: VideoEntry) {
    setPlayerError(null);
    setPlaying(v);
  }
  const [cat, setCat] = useState<'SOMMER' | 'WINTER' | 'WEITERE'>('SOMMER');

  useEffect(() => {
    fetchVideos()
      .then(data => {
        setVideos(data);
        const nav = buildNav(data);
        if (nav.sommer.length > 0) setSelection({ cat: 'SOMMER', year: nav.sommer[0].year, day: nav.sommer[0].days[0] ?? null });
        else if (nav.winter.length > 0) { setCat('WINTER'); setSelection({ cat: 'WINTER', year: nav.winter[0].year, day: nav.winter[0].days[0] ?? null }); }
        else if (nav.weitere.length > 0) { setCat('WEITERE'); setSelection({ cat: 'WEITERE', sub: nav.weitere[0] }); }
      })
      .catch(() => setVideos([]))
      .finally(() => setLoading(false));
  }, []);

  const nav: NavStructure = useMemo(() => buildNav(videos), [videos]);

  const shown = useMemo(() => {
    if (!selection) return [];
    if (selection.cat === 'WEITERE') {
      return videos.filter(v => v.category === 'WEITERE' && v.subcategory === selection.sub)
        .sort((a, b) => a.position - b.position);
    }
    return videos.filter(v => v.category === selection.cat && v.year === selection.year && (selection.day ? v.day === selection.day : true));
  }, [videos, selection]);

  const columns = width >= 700 ? 3 : 2;
  const gap = spacing.md;
  const tileWidth = (width - spacing.lg * 2 - gap * (columns - 1)) / columns;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary600} size="large" /></View>;
  }

  const years = cat === 'WEITERE' ? [] : (cat === 'SOMMER' ? nav.sommer : nav.winter);
  const currentYearDays = selection && selection.cat !== 'WEITERE'
    ? years.find(y => y.year === selection.year)?.days ?? []
    : [];

  return (
    <View style={styles.container}>
      {/* Kategorie */}
      <View style={styles.catRow}>
        {(['SOMMER', 'WINTER', 'WEITERE'] as const).map(c => (
          <Pressable
            key={c}
            style={[styles.catChip, cat === c && styles.catChipActive]}
            onPress={() => {
              setCat(c);
              if (c === 'WEITERE' && nav.weitere.length > 0) setSelection({ cat: 'WEITERE', sub: nav.weitere[0] });
              else if (c !== 'WEITERE') {
                const list = c === 'SOMMER' ? nav.sommer : nav.winter;
                if (list.length > 0) setSelection({ cat: c, year: list[0].year, day: list[0].days[0] ?? null });
                else setSelection(null);
              }
            }}
          >
            <Text style={[styles.catChipText, cat === c && styles.catChipTextActive]}>
              {c === 'SOMMER' ? 'Sommerkonzert' : c === 'WINTER' ? 'Winterkonzert' : 'Weitere'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Jahr / Unterkategorie */}
      {cat === 'WEITERE' ? (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={nav.weitere}
          keyExtractor={s => s}
          contentContainerStyle={styles.subRow}
          renderItem={({ item: sub }) => (
            <Pressable
              style={[styles.subChip, isSel(selection, { cat: 'WEITERE', sub }) && styles.subChipActive]}
              onPress={() => setSelection({ cat: 'WEITERE', sub })}
            >
              <Text style={[styles.subChipText, isSel(selection, { cat: 'WEITERE', sub }) && styles.subChipTextActive]}>{sub}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.emptyHint}>Keine Videos</Text>}
        />
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={years}
          keyExtractor={y => y.year}
          contentContainerStyle={styles.subRow}
          renderItem={({ item: y }) => (
            <Pressable
              style={[styles.subChip, isSel(selection, { cat, year: y.year, day: null }) && styles.subChipActive]}
              onPress={() => setSelection({ cat, year: y.year, day: y.days[0] ?? null })}
            >
              <Text style={[styles.subChipText, isSel(selection, { cat, year: y.year, day: null }) && styles.subChipTextActive]}>{y.year}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.emptyHint}>Keine Videos</Text>}
        />
      )}

      {/* Tag (falls vorhanden) */}
      {currentYearDays.length > 0 && selection && selection.cat !== 'WEITERE' && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={currentYearDays}
          keyExtractor={d => d}
          contentContainerStyle={styles.subRow}
          renderItem={({ item: day }) => {
            const sel = selection as { cat: 'SOMMER' | 'WINTER'; year: string; day: string | null };
            return (
              <Pressable
                style={[styles.dayChip, isSel(selection, { cat: sel.cat, year: sel.year, day }) && styles.dayChipActive]}
                onPress={() => setSelection({ cat: sel.cat, year: sel.year, day })}
              >
                <Text style={[styles.dayChipText, isSel(selection, { cat: sel.cat, year: sel.year, day }) && styles.dayChipTextActive]}>{day}</Text>
              </Pressable>
            );
          }}
        />
      )}

      {/* Video-Grid */}
      {shown.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="film-outline" size={36} color={colors.textFaint} style={{ marginBottom: spacing.sm }} />
          <Text style={styles.emptyText}>Noch keine Videos in dieser Auswahl.</Text>
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={v => v.id}
          numColumns={columns}
          key={columns}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap }}
          ItemSeparatorComponent={() => <View style={{ height: gap }} />}
          renderItem={({ item }) => {
            const thumb = thumbnailFor(item);
            return (
              <Pressable style={{ width: tileWidth }} onPress={() => openPlayer(item)}>
                <View style={[styles.thumbWrap, { width: tileWidth, height: tileWidth * 9 / 16 }]}>
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={styles.thumbImage} />
                  ) : (
                    <View style={[styles.thumbImage, styles.thumbPlaceholder]}>
                      <Ionicons name="albums-outline" size={24} color={colors.textFaint} />
                    </View>
                  )}
                  <View style={styles.playBadge}>
                    <Ionicons name="play" size={14} color="#fff" />
                  </View>
                  {item.type === 'PLAYLIST' && (
                    <View style={styles.playlistBadge}>
                      <Text style={styles.playlistBadgeText}>Playlist</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
              </Pressable>
            );
          }}
        />
      )}

      {playing && (
        <Modal visible animationType="slide" onRequestClose={() => setPlaying(null)}>
          <View style={styles.playerModal}>
            <View style={styles.playerHeader}>
              <Text style={styles.playerTitle} numberOfLines={1}>{playing.title}</Text>
              <Pressable onPress={() => setPlaying(null)} hitSlop={12}>
                <Ionicons name="close" size={26} color="#fff" />
              </Pressable>
            </View>
            {playerError !== null ? (
              <View style={styles.playerError}>
                <Ionicons name="alert-circle-outline" size={36} color={colors.textFaint} />
                <Text style={styles.playerErrorTitle}>Dieses Video kann hier nicht abgespielt werden</Text>
                <Text style={styles.playerErrorHint}>Fehlercode {playerError} - eventuell ist die Einbettung eingeschränkt.</Text>
                <Pressable style={styles.playerErrorButton} onPress={() => Linking.openURL(watchUrl(playing))}>
                  <Ionicons name="logo-youtube" size={18} color="#fff" />
                  <Text style={styles.playerErrorButtonText}>Auf YouTube ansehen</Text>
                </Pressable>
              </View>
            ) : (
              <WebView
                key={playing.id}
                source={{ html: buildPlayerHtml(playing), baseUrl: 'https://www.schwalmtalzupfer.de' }}
                style={styles.webview}
                allowsFullscreenVideo
                mediaPlaybackRequiresUserAction={false}
                onMessage={e => {
                  try {
                    const data = JSON.parse(e.nativeEvent.data);
                    if (data.type === 'error') setPlayerError(data.code);
                  } catch { /* ignorieren */ }
                }}
              />
            )}
          </View>
        </Modal>
      )}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surfaceMuted },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.surfaceMuted },
    catRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm },
    catChip: { flex: 1, paddingVertical: 8, borderRadius: radius.md, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    catChipActive: { backgroundColor: colors.primary600, borderColor: colors.primary600 },
    catChipText: { fontFamily: font.medium, fontSize: 12, color: colors.textMuted },
    catChipTextActive: { color: '#fff', fontFamily: font.semiBold },
    subRow: { paddingHorizontal: spacing.lg, gap: spacing.xs, paddingBottom: spacing.sm, alignItems: 'center' },
    subChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    subChipActive: { backgroundColor: colors.text, borderColor: colors.text },
    subChipText: { fontFamily: font.medium, fontSize: 13, color: colors.textMuted },
    subChipTextActive: { color: colors.background },
    dayChip: { paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.full, backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
    dayChipActive: { backgroundColor: colors.primary50, borderColor: colors.primary600 },
    dayChipText: { fontFamily: font.regular, fontSize: 12, color: colors.textMuted },
    dayChipTextActive: { color: colors.primary700, fontFamily: font.semiBold },
    emptyHint: { fontFamily: font.regular, fontSize: 12, color: colors.textFaint, fontStyle: 'italic' },
    emptyText: { color: colors.textFaint, fontFamily: font.regular, textAlign: 'center' },
    grid: { padding: spacing.lg, paddingTop: spacing.sm },
    thumbWrap: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface, position: 'relative' },
    thumbImage: { width: '100%', height: '100%' },
    thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    playBadge: {
      position: 'absolute', bottom: 6, right: 6, width: 26, height: 26, borderRadius: 13,
      backgroundColor: 'rgba(220,38,38,0.9)', alignItems: 'center', justifyContent: 'center',
    },
    playlistBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
    playlistBadgeText: { color: '#fff', fontFamily: font.semiBold, fontSize: 9 },
    videoTitle: { fontFamily: font.medium, fontSize: 12, color: colors.text, marginTop: 6 },
    playerModal: { flex: 1, backgroundColor: '#000' },
    playerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, paddingTop: spacing.xl },
    playerTitle: { flex: 1, color: '#fff', fontFamily: font.semiBold, fontSize: 15, marginRight: spacing.sm },
    webview: { flex: 1, backgroundColor: '#000' },
    playerError: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
    playerErrorTitle: { color: '#fff', fontFamily: font.semiBold, fontSize: 16, textAlign: 'center', marginTop: spacing.sm },
    playerErrorHint: { color: 'rgba(255,255,255,0.6)', fontFamily: font.regular, fontSize: 13, textAlign: 'center' },
    playerErrorButton: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: '#dc2626',
      borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: spacing.lg, marginTop: spacing.md,
    },
    playerErrorButtonText: { color: '#fff', fontFamily: font.semiBold, fontSize: 14 },
  });
}
