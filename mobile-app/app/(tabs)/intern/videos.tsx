import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  View, Text, Image, Pressable, StyleSheet, ActivityIndicator, ScrollView,
  Modal, useWindowDimensions, Linking, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from '../../../components/WebView';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchVideos, thumbnailFor, buildVideoPlayerHtml, buildPlaylistEmbedHtml, fetchPlaylistItems,
  usePlaylistItems, clearPlaylistCache, watchUrl, buildNav, defaultSelection, selectionStillValid,
  selectionLabel, sortSlots, extractYearTag, DAYS_ORDER,
  type VideoEntry, type PlaylistItem, type Selection,
} from '../../../lib/videos';
import { absoluteApiUrl } from '../../../lib/api';
import { font, radius, spacing, type ColorTokens } from '../../../lib/theme';
import { useAppTheme } from '../../../lib/ThemeContext';

// Aufbau wie auf der Webseite (/intern/videos):
//   Kategorie → Jahr → (Tage-Übersicht) → Tag → (Abschnitte-Übersicht) → Abschnitt
//   → jede Playlist als eigener Abschnitt MIT ihren Videos, Einzelvideos darunter.
// Ein Tipp auf ein Video öffnet den Player direkt an genau dieser Stelle der Playlist;
// im Player gibt es Vor/Zurück, die komplette Playlist und "Weitere Videos" der Auswahl.

type Opener = (video: VideoEntry, pool: VideoEntry[], startVideoId?: string) => void;
type Styles = ReturnType<typeof createStyles>;

const MAX_CONTENT_WIDTH = 1200;
const PANEL_WIDTH = 380;
const WIDE_PLAYER_BREAKPOINT = 1000;

type ContentView =
  | { kind: 'groups'; level: 'day' | 'slot'; keys: string[]; source: VideoEntry[] }
  | { kind: 'list'; items: VideoEntry[] }
  | { kind: 'weitere'; groups: [string, VideoEntry[]][]; all: VideoEntry[] }
  | { kind: 'empty' };

function computeView(videos: VideoEntry[], sel: Selection): ContentView {
  if (sel.cat === 'WEITERE') {
    const all = videos
      .filter(v => v.category === 'WEITERE' && v.subcategory === sel.sub)
      .sort((a, b) => a.position - b.position);
    if (all.length === 0) return { kind: 'empty' };
    const byYear = new Map<string, VideoEntry[]>();
    for (const v of all) {
      const yr = extractYearTag(v.tags) ?? '';
      if (!byYear.has(yr)) byYear.set(yr, []);
      byYear.get(yr)!.push(v);
    }
    if (byYear.size <= 1) return { kind: 'list', items: all };
    const groups = [...byYear.entries()].sort(([a], [b]) => (b || '0').localeCompare(a || '0'));
    return { kind: 'weitere', groups, all };
  }

  const yearVideos = videos.filter(v => v.category === sel.cat && v.year === sel.year);
  const days = DAYS_ORDER.filter(d => yearVideos.some(v => v.day === d));
  if (!sel.day && days.length > 1) return { kind: 'groups', level: 'day', keys: days, source: yearVideos };

  const dayVideos = sel.day ? yearVideos.filter(v => v.day === sel.day) : yearVideos;
  const slots = sel.day ? sortSlots([...new Set(dayVideos.map(v => v.subcategory).filter(Boolean) as string[])]) : [];
  if (sel.day && !sel.slot && slots.length > 1) return { kind: 'groups', level: 'slot', keys: slots, source: dayVideos };

  const items = sel.slot ? dayVideos.filter(v => v.subcategory === sel.slot) : dayVideos;
  return items.length === 0 ? { kind: 'empty' } : { kind: 'list', items };
}

function countLabel(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export default function VideosScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [watch, setWatch] = useState<{ video: VideoEntry; pool: VideoEntry[]; startVideoId?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchVideos();
      const nav = buildNav(data);
      setVideos(data);
      setLoadError(false);
      setSelection(prev => (prev && selectionStillValid(nav, prev) ? prev : defaultSelection(nav)));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function onRefresh() {
    setRefreshing(true);
    clearPlaylistCache();
    setRefreshKey(k => k + 1);
    load();
  }

  function select(s: Selection) {
    setSelection(s);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  const openWatch: Opener = useCallback((video, pool, startVideoId) => setWatch({ video, pool, startVideoId }), []);

  const nav = useMemo(() => buildNav(videos), [videos]);
  const view = useMemo(() => (selection ? computeView(videos, selection) : null), [videos, selection]);

  // Layout: auf breiten Bildschirmen (Tablet, Web-App am Desktop) zentriert und mehrspaltig.
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH);
  const pad = width >= 700 ? spacing.lg : spacing.md;
  const inner = contentWidth - pad * 2;
  const columns = contentWidth >= 1100 ? 4 : contentWidth >= 700 ? 3 : 2;
  const gap = spacing.md;
  const tileWidth = Math.floor((inner - gap * (columns - 1)) / columns);
  const compact = contentWidth < 700;
  const layout: Layout = { tileWidth, columns, gap, compact };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary600} size="large" /></View>;
  }

  if (loadError && videos.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.textFaint} />
        <Text style={styles.emptyTitle}>Videos konnten nicht geladen werden</Text>
        <Text style={styles.emptyText}>Bitte Internetverbindung prüfen und erneut versuchen.</Text>
        <Pressable style={styles.primaryButton} onPress={() => { setLoading(true); load(); }}>
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text style={styles.primaryButtonText}>Erneut versuchen</Text>
        </Pressable>
      </View>
    );
  }

  if (!selection) {
    return (
      <View style={styles.center}>
        <Ionicons name="film-outline" size={40} color={colors.textFaint} />
        <Text style={styles.emptyTitle}>Noch keine Videos</Text>
        <Text style={styles.emptyText}>Videos können im Verwaltungsbereich der Webseite hinzugefügt werden.</Text>
      </View>
    );
  }

  const cat = selection.cat;
  const konzertYears = cat === 'SOMMER' ? nav.sommer : cat === 'WINTER' ? nav.winter : [];
  const konzertSel = selection.cat !== 'WEITERE' ? selection : null;
  const yearDays = konzertSel ? konzertYears.find(y => y.year === konzertSel.year)?.days ?? [] : [];
  const daySlots = konzertSel && konzertSel.day
    ? sortSlots([...new Set(videos
        .filter(v => v.category === konzertSel.cat && v.year === konzertSel.year && v.day === konzertSel.day)
        .map(v => v.subcategory).filter(Boolean) as string[])])
    : [];

  function switchCategory(c: VideoEntry['category']) {
    if (c === 'WEITERE') {
      if (nav.weitere.length > 0) select({ cat: 'WEITERE', sub: nav.weitere[0] });
      return;
    }
    const list = c === 'SOMMER' ? nav.sommer : nav.winter;
    if (list.length > 0) select({ cat: c, year: list[0].year, day: null, slot: null });
  }

  function goUp() {
    if (!konzertSel) return;
    if (konzertSel.slot) select({ ...konzertSel, slot: null });
    else if (konzertSel.day) select({ ...konzertSel, day: null, slot: null });
  }

  const categoryDefs: { key: VideoEntry['category']; label: string; short: string; icon: keyof typeof Ionicons.glyphMap; count: number }[] = [
    { key: 'SOMMER', label: 'Sommerkonzert', short: 'Sommer', icon: 'sunny-outline', count: nav.sommer.length },
    { key: 'WINTER', label: 'Winterkonzert', short: 'Winter', icon: 'snow-outline', count: nav.winter.length },
    { key: 'WEITERE', label: 'Weitere Auftritte', short: 'Weitere', icon: 'star-outline', count: nav.weitere.length },
  ];

  const canGoUp = !!konzertSel && (!!konzertSel.slot || (!!konzertSel.day && yearDays.length > 1));

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[0]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary600} colors={[colors.primary600]} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Fixierte Navigation: Kategorie + Jahr / Rubrik */}
        <View style={styles.stickyNav}>
          <View style={[styles.navInner, { width: contentWidth, paddingHorizontal: pad }]}>
            <View style={styles.catRow}>
              {categoryDefs.map(c => {
                const active = cat === c.key;
                const disabled = c.count === 0;
                return (
                  <Pressable
                    key={c.key}
                    disabled={disabled}
                    onPress={() => switchCategory(c.key)}
                    style={[styles.catChip, active && styles.catChipActive, disabled && styles.disabled]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active, disabled }}
                  >
                    <Ionicons name={c.icon} size={15} color={active ? '#fff' : colors.textMuted} />
                    <Text style={[styles.catChipText, active && styles.catChipTextActive]} numberOfLines={1}>
                      {contentWidth < 420 ? c.short : c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, { paddingHorizontal: pad }]}>
            {selection.cat === 'WEITERE'
              ? nav.weitere.map(sub => (
                  <Chip key={sub} styles={styles} label={sub} active={selection.sub === sub} onPress={() => select({ cat: 'WEITERE', sub })} />
                ))
              : konzertYears.map(y => (
                  <Chip
                    key={y.year}
                    styles={styles}
                    label={y.year}
                    active={konzertSel?.year === y.year}
                    onPress={() => select({ cat: selection.cat as 'SOMMER' | 'WINTER', year: y.year, day: null, slot: null })}
                  />
                ))}
          </ScrollView>
        </View>

        <View style={{ width: contentWidth, alignSelf: 'center', paddingHorizontal: pad }}>
          {/* Tage */}
          {konzertSel && yearDays.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subChipRow}>
              <Chip styles={styles} small icon="grid-outline" label="Alle Tage" active={konzertSel.day === null} onPress={() => select({ ...konzertSel, day: null, slot: null })} />
              {yearDays.map(d => (
                <Chip key={d} styles={styles} small label={d} active={konzertSel.day === d} onPress={() => select({ ...konzertSel, day: d, slot: null })} />
              ))}
            </ScrollView>
          )}

          {/* Zeitabschnitte eines Tages */}
          {konzertSel && konzertSel.day && daySlots.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subChipRow}>
              <Chip styles={styles} small icon="grid-outline" label="Übersicht" active={konzertSel.slot === null} onPress={() => select({ ...konzertSel, slot: null })} />
              {daySlots.map(s => (
                <Chip key={s} styles={styles} small icon="time-outline" label={s} active={konzertSel.slot === s} onPress={() => select({ ...konzertSel, slot: s })} />
              ))}
            </ScrollView>
          )}

          {/* Überschrift der aktuellen Auswahl */}
          <View style={styles.titleBar}>
            {canGoUp && (
              <Pressable onPress={goUp} hitSlop={10} style={styles.backButton} accessibilityLabel="Eine Ebene zurück">
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </Pressable>
            )}
            <View style={styles.titleAccent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.titleText} numberOfLines={2}>{selectionLabel(selection)}</Text>
              {view && <Text style={styles.titleMeta}>{viewMeta(view)}</Text>}
            </View>
          </View>

          <View key={refreshKey}>
            {view?.kind === 'groups' && (
              <TileGrid layout={layout}>
                {view.keys.map(key => {
                  const entries = view.source
                    .filter(v => (view.level === 'day' ? v.day : v.subcategory) === key)
                    .sort((a, b) => a.position - b.position);
                  if (entries.length === 0 || !konzertSel) return null;
                  return (
                    <GroupCard
                      key={key}
                      styles={styles}
                      colors={colors}
                      width={tileWidth}
                      title={key}
                      icon={view.level === 'day' ? 'calendar-outline' : 'time-outline'}
                      entries={entries}
                      onPress={() => select(view.level === 'day'
                        ? { ...konzertSel, day: key, slot: null }
                        : { ...konzertSel, slot: key })}
                    />
                  );
                })}
              </TileGrid>
            )}

            {view?.kind === 'list' && (
              <SplitVideos items={view.items} pool={view.items} onOpen={openWatch} styles={styles} colors={colors} layout={layout} />
            )}

            {view?.kind === 'weitere' && view.groups.map(([year, vids]) => (
              <View key={year || 'ohne'} style={{ marginBottom: spacing.lg }}>
                <View style={styles.yearDivider}>
                  <Text style={styles.yearDividerText}>{year || 'Weitere'}</Text>
                  <View style={styles.yearDividerLine} />
                </View>
                <SplitVideos items={vids} pool={view.all} onOpen={openWatch} styles={styles} colors={colors} layout={layout} />
              </View>
            ))}

            {view?.kind === 'empty' && (
              <View style={styles.emptyBox}>
                <Ionicons name="film-outline" size={32} color={colors.textFaint} />
                <Text style={styles.emptyText}>Noch keine Videos in dieser Auswahl.</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {watch && (
        <PlayerModal
          key={`${watch.video.id}__${watch.startVideoId ?? ''}`}
          initialVideo={watch.video}
          pool={watch.pool}
          startVideoId={watch.startVideoId}
          onClose={() => setWatch(null)}
        />
      )}
    </View>
  );
}

function viewMeta(view: ContentView): string {
  switch (view.kind) {
    case 'groups': return view.level === 'day' ? `${countLabel(view.keys.length, 'Tag', 'Tage')} – Tag auswählen` : `${countLabel(view.keys.length, 'Abschnitt', 'Abschnitte')} – Abschnitt auswählen`;
    case 'list':
    case 'weitere': {
      const items = view.kind === 'list' ? view.items : view.all;
      const p = items.filter(v => v.type === 'PLAYLIST').length;
      const s = items.length - p;
      return [p > 0 ? countLabel(p, 'Playlist', 'Playlists') : null, s > 0 ? countLabel(s, 'Video', 'Videos') : null].filter(Boolean).join(' · ');
    }
    default: return '';
  }
}

// ─── Bausteine ───────────────────────────────────────────────────────────────

interface Layout { tileWidth: number; columns: number; gap: number; compact: boolean }

function Chip({ label, active, onPress, styles, small, icon }: {
  label: string; active: boolean; onPress: () => void; styles: Styles; small?: boolean; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[small ? styles.subChip : styles.chip, active && (small ? styles.subChipActive : styles.chipActive)]}
      accessibilityState={{ selected: active }}
    >
      {icon && <Ionicons name={icon} size={13} color={active ? (small ? colors.primary700 : colors.background) : colors.textMuted} />}
      <Text style={[small ? styles.subChipText : styles.chipText, active && (small ? styles.subChipTextActive : styles.chipTextActive)]}>{label}</Text>
    </Pressable>
  );
}

function TileGrid({ layout, children }: { layout: Layout; children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: layout.gap, rowGap: spacing.lg }}>{children}</View>;
}

function Thumb({ uri, width, styles, colors, children, placeholderIcon = 'albums-outline' }: {
  uri: string | null; width: number; styles: Styles; colors: ColorTokens; children?: ReactNode; placeholderIcon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.thumbWrap, { width, height: (width * 9) / 16 }]}>
      {uri ? (
        <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
      ) : (
        <View style={[styles.thumbImage, styles.thumbPlaceholder]}>
          <Ionicons name={placeholderIcon} size={26} color={colors.textFaint} />
        </View>
      )}
      {children}
    </View>
  );
}

/** Kachel für einen Tag bzw. Zeitabschnitt: Titelbild = erstes Video der Playlist, mit Anzahl. */
function GroupCard({ title, icon, entries, width, onPress, styles, colors }: {
  title: string; icon: keyof typeof Ionicons.glyphMap; entries: VideoEntry[]; width: number; onPress: () => void; styles: Styles; colors: ColorTokens;
}) {
  const representative = entries.find(v => v.type === 'PLAYLIST') ?? entries[0];
  const items = usePlaylistItems(representative.type === 'PLAYLIST' ? representative.youtubeId : null);
  const thumb = thumbnailFor(representative) ?? (items && items[0] ? absoluteApiUrl(items[0].thumbnail) : null);
  const playlists = entries.filter(v => v.type === 'PLAYLIST').length;
  const count = representative.type === 'PLAYLIST' && playlists === 1 && entries.length === 1 ? items?.length : entries.length;

  return (
    <Pressable onPress={onPress} style={{ width }} accessibilityRole="button" accessibilityLabel={title}>
      <Thumb uri={thumb} width={width} styles={styles} colors={colors} placeholderIcon={icon}>
        <View style={styles.countOverlay}>
          <Ionicons name="list" size={16} color="#fff" />
          <Text style={styles.countOverlayText}>{count ?? '…'}</Text>
        </View>
      </Thumb>
      <View style={styles.cardTextRow}>
        <Ionicons name={icon} size={15} color={colors.primary600} />
        <Text style={styles.groupTitle} numberOfLines={1}>{title}</Text>
      </View>
      <Text style={styles.cardMeta}>
        {count == null ? 'Lädt…' : playlists > 0 && entries.length > 1 ? countLabel(entries.length, 'Eintrag', 'Einträge') : countLabel(count, 'Video', 'Videos')}
      </Text>
    </Pressable>
  );
}

function SplitVideos({ items, pool, onOpen, styles, colors, layout }: {
  items: VideoEntry[]; pool: VideoEntry[]; onOpen: Opener; styles: Styles; colors: ColorTokens; layout: Layout;
}) {
  const playlists = items.filter(v => v.type === 'PLAYLIST');
  const singles = items.filter(v => v.type === 'VIDEO');
  return (
    <View>
      {playlists.map(p => (
        <PlaylistSection key={p.id} playlist={p} pool={pool} onOpen={onOpen} styles={styles} colors={colors} layout={layout} />
      ))}
      {singles.length > 0 && (
        <View>
          {playlists.length > 0 && (
            <View style={styles.sectionLabelRow}>
              <Ionicons name="videocam-outline" size={15} color={colors.textFaint} />
              <Text style={styles.sectionLabel}>Einzelne Videos</Text>
            </View>
          )}
          <TileGrid layout={layout}>
            {singles.map(v => (
              <Pressable key={v.id} style={{ width: layout.tileWidth }} onPress={() => onOpen(v, pool)} accessibilityRole="button" accessibilityLabel={v.title}>
                <Thumb uri={thumbnailFor(v)} width={layout.tileWidth} styles={styles} colors={colors}>
                  <View style={styles.playBadge}><Ionicons name="play" size={14} color="#fff" /></View>
                </Thumb>
                <Text style={styles.videoTitle} numberOfLines={2}>{v.title}</Text>
              </Pressable>
            ))}
          </TileGrid>
        </View>
      )}
    </View>
  );
}

/** Eine Playlist mit ihren Videos direkt sichtbar - wie auf der Webseite. */
function PlaylistSection({ playlist, pool, onOpen, styles, colors, layout }: {
  playlist: VideoEntry; pool: VideoEntry[]; onOpen: Opener; styles: Styles; colors: ColorTokens; layout: Layout;
}) {
  const items = usePlaylistItems(playlist.youtubeId);
  const [expanded, setExpanded] = useState(false);
  const limit = layout.compact ? 5 : layout.columns * 2;
  const visible = items ? (expanded ? items : items.slice(0, limit)) : [];
  const cover = thumbnailFor(playlist) ?? (items && items[0] ? absoluteApiUrl(items[0].thumbnail) : null);

  return (
    <View style={styles.playlistCard}>
      <View style={styles.playlistHeader}>
        <View style={styles.playlistCover}>
          {cover ? <Image source={{ uri: cover }} style={styles.thumbImage} /> : (
            <View style={[styles.thumbImage, styles.thumbPlaceholder]}><Ionicons name="albums-outline" size={20} color={colors.textFaint} /></View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.playlistTitle} numberOfLines={2}>{playlist.title}</Text>
          <Text style={styles.cardMeta}>Playlist · {items === null ? 'lädt…' : countLabel(items.length, 'Video', 'Videos')}</Text>
        </View>
      </View>

      <View style={styles.playlistActions}>
        <Pressable style={styles.primaryButton} onPress={() => onOpen(playlist, pool)} accessibilityRole="button">
          <Ionicons name="play" size={15} color="#fff" />
          <Text style={styles.primaryButtonText}>Alle abspielen</Text>
        </Pressable>
        <Pressable style={styles.ghostButton} onPress={() => Linking.openURL(watchUrl(playlist))} accessibilityRole="link">
          <Ionicons name="logo-youtube" size={16} color={colors.textMuted} />
          <Text style={styles.ghostButtonText}>YouTube</Text>
        </Pressable>
      </View>

      {items === null ? (
        <View style={{ gap: spacing.sm }}>
          {[0, 1, 2].map(i => <View key={i} style={styles.skeletonRow} />)}
        </View>
      ) : items.length === 0 ? (
        <Text style={styles.emptyText}>Die Videoliste dieser Playlist konnte nicht geladen werden – „Alle abspielen“ startet sie trotzdem.</Text>
      ) : layout.compact ? (
        <View>
          {visible.map((item, idx) => (
            <Pressable key={item.videoId} style={styles.itemRow} onPress={() => onOpen(playlist, pool, item.videoId)} accessibilityRole="button" accessibilityLabel={item.title}>
              <View style={styles.itemThumb}>
                <Image source={{ uri: absoluteApiUrl(item.thumbnail) }} style={styles.thumbImage} />
                <View style={styles.indexBadge}><Text style={styles.indexBadgeText}>{idx + 1}</Text></View>
              </View>
              <Text style={styles.itemTitle} numberOfLines={3}>{item.title}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: layout.gap, rowGap: spacing.md }}>
          {visible.map((item, idx) => {
            // Kachelbreite innerhalb der Karte (Karte hat eigenes Padding + 1px Rahmen je Seite).
            const cardInner = layout.tileWidth * layout.columns + layout.gap * (layout.columns - 1) - spacing.md * 2 - 2;
            const w = Math.floor((cardInner - layout.gap * (layout.columns - 1)) / layout.columns);
            return (
              <Pressable key={item.videoId} style={{ width: w }} onPress={() => onOpen(playlist, pool, item.videoId)} accessibilityRole="button" accessibilityLabel={item.title}>
                <Thumb uri={absoluteApiUrl(item.thumbnail)} width={w} styles={styles} colors={colors}>
                  <View style={styles.indexBadge}><Text style={styles.indexBadgeText}>{idx + 1}</Text></View>
                </Thumb>
                <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {items && items.length > limit && (
        <Pressable style={styles.moreButton} onPress={() => setExpanded(e => !e)}>
          <Text style={styles.moreButtonText}>{expanded ? 'Weniger anzeigen' : `Alle ${items.length} Videos anzeigen`}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary700} />
        </Pressable>
      )}
    </View>
  );
}

// ─── Player ──────────────────────────────────────────────────────────────────

function PlayerModal({ initialVideo, pool, startVideoId, onClose }: {
  initialVideo: VideoEntry; pool: VideoEntry[]; startVideoId?: string; onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panelScrollRef = useRef<ScrollView>(null);
  const listOffsetRef = useRef(0);
  const rowYRef = useRef(new Map<string, number>());
  const wantedStartRef = useRef<string | undefined>(startVideoId);

  const [active, setActive] = useState(initialVideo);
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [listLoading, setListLoading] = useState(initialVideo.type === 'PLAYLIST');
  const [currentVideoId, setCurrentVideoId] = useState(initialVideo.type === 'VIDEO' ? initialVideo.youtubeId : '');
  const [playerError, setPlayerError] = useState<number | null>(null);
  const [panelHidden, setPanelHidden] = useState(false);

  useEffect(() => {
    setPlayerError(null);
    rowYRef.current.clear();
    if (active.type === 'VIDEO') {
      setItems([]);
      setCurrentVideoId(active.youtubeId);
      setListLoading(false);
      return;
    }
    let cancelled = false;
    setListLoading(true);
    setItems([]);
    setCurrentVideoId('');
    fetchPlaylistItems(active.youtubeId)
      .then(list => {
        if (cancelled) return;
        setItems(list);
        const wanted = wantedStartRef.current;
        wantedStartRef.current = undefined;
        if (list.length > 0) setCurrentVideoId(wanted && list.some(i => i.videoId === wanted) ? wanted : list[0].videoId);
      })
      .finally(() => { if (!cancelled) setListLoading(false); });
    return () => { cancelled = true; };
  }, [active]);

  const isPlaylist = active.type === 'PLAYLIST';
  const idx = items.findIndex(i => i.videoId === currentVideoId);
  const hasPrev = isPlaylist && idx > 0;
  const hasNext = isPlaylist && idx >= 0 && idx < items.length - 1;
  const related = pool.filter(v => v.id !== active.id);
  const currentItem = idx >= 0 ? items[idx] : undefined;
  const title = currentItem?.title ?? active.title;
  const useFallbackEmbed = isPlaylist && !listLoading && items.length === 0;

  // Aktuelles Video in der Liste sichtbar halten (z.B. nach automatischem Weiterspringen).
  useEffect(() => {
    const y = rowYRef.current.get(currentVideoId);
    if (y != null) panelScrollRef.current?.scrollTo({ y: Math.max(0, listOffsetRef.current + y - 60), animated: true });
  }, [currentVideoId]);

  function go(delta: number) {
    const next = items[idx + delta];
    if (next) { setCurrentVideoId(next.videoId); setPlayerError(null); }
  }

  function handleMessage(raw: string) {
    try {
      const data = JSON.parse(raw);
      if (data.type === 'error') setPlayerError(data.code);
      else if (data.type === 'ended') go(1);
    } catch {
      // ignorieren
    }
  }

  function switchTo(v: VideoEntry) {
    wantedStartRef.current = undefined;
    setActive(v);
    panelScrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  // Größen: breit (Tablet quer / Desktop) = Video links, Liste rechts; Handy hochkant = Video oben,
  // Liste darunter; Handy quer oder Liste ausgeblendet = Video füllt den Bildschirm.
  const headerHeight = Math.max(insets.top, spacing.sm) + 52;
  const availableHeight = height - headerHeight - insets.bottom;
  const wide = width >= WIDE_PLAYER_BREAKPOINT;
  const landscapePhone = !wide && width > height;
  const showPanel = !panelHidden && !landscapePhone;
  let videoW = width;
  let videoH = availableHeight;
  if (showPanel && wide) {
    videoW = width - PANEL_WIDTH;
    videoH = Math.min((videoW * 9) / 16, availableHeight);
  } else if (showPanel) {
    videoH = (width * 9) / 16;
  }
  const sizeKey = `${Math.round(videoW)}x${Math.round(videoH)}`;

  const videoBox = (
    <View style={{ width: videoW, height: videoH, backgroundColor: '#000' }}>
      {isPlaylist && listLoading ? (
        <View style={ps.centerFill}>
          <ActivityIndicator color="#fff" />
          <Text style={ps.hint}>Lade Playlist…</Text>
        </View>
      ) : playerError !== null ? (
        <View style={ps.centerFill}>
          <Ionicons name="alert-circle-outline" size={32} color="rgba(255,255,255,0.6)" />
          <Text style={ps.errorTitle}>Dieses Video kann hier nicht abgespielt werden</Text>
          <Text style={ps.hint}>Fehlercode {playerError} – eventuell ist die Einbettung eingeschränkt.</Text>
          <Pressable
            style={ps.youtubeButton}
            onPress={() => Linking.openURL(currentVideoId ? `https://www.youtube.com/watch?v=${currentVideoId}` : watchUrl(active))}
          >
            <Ionicons name="logo-youtube" size={18} color="#fff" />
            <Text style={ps.youtubeButtonText}>Auf YouTube ansehen</Text>
          </Pressable>
          {hasNext && (
            <Pressable onPress={() => go(1)} hitSlop={8}>
              <Text style={ps.skip}>Nächstes Video →</Text>
            </Pressable>
          )}
        </View>
      ) : useFallbackEmbed ? (
        // Keine Items von der Playlist-API (z.B. fehlender YouTube-API-Key) -> rohes Playlist-Embed.
        <WebView
          key={`list_${active.youtubeId}_${sizeKey}`}
          source={{ html: buildPlaylistEmbedHtml(active.youtubeId, videoW, videoH), baseUrl: 'https://www.schwalmtalzupfer.de' }}
          style={ps.webview}
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          onMessage={e => handleMessage(e.nativeEvent.data)}
        />
      ) : currentVideoId ? (
        <WebView
          key={`${currentVideoId}_${sizeKey}`}
          source={{ html: buildVideoPlayerHtml(currentVideoId, videoW, videoH), baseUrl: 'https://www.schwalmtalzupfer.de' }}
          style={ps.webview}
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          onMessage={e => handleMessage(e.nativeEvent.data)}
        />
      ) : null}
    </View>
  );

  const panel = (
    <ScrollView ref={panelScrollRef} style={[ps.panel, wide && { width: PANEL_WIDTH, flex: undefined }]} contentContainerStyle={{ paddingBottom: spacing.xl + insets.bottom }}>
      <View style={ps.info}>
        <Text style={ps.infoTitle}>{title}</Text>
        {isPlaylist && (
          <Text style={ps.infoMeta}>
            Playlist · {active.title}{idx >= 0 ? ` · ${idx + 1} von ${items.length}` : ''}
          </Text>
        )}
        <View style={ps.infoActions}>
          {isPlaylist && (
            <>
              <Pressable style={[ps.pill, !hasPrev && ps.pillDisabled]} disabled={!hasPrev} onPress={() => go(-1)}>
                <Ionicons name="play-skip-back" size={15} color="#fff" />
                <Text style={ps.pillText}>Zurück</Text>
              </Pressable>
              <Pressable style={[ps.pill, !hasNext && ps.pillDisabled]} disabled={!hasNext} onPress={() => go(1)}>
                <Text style={ps.pillText}>Weiter</Text>
                <Ionicons name="play-skip-forward" size={15} color="#fff" />
              </Pressable>
            </>
          )}
          <Pressable
            style={ps.pill}
            onPress={() => Linking.openURL(currentVideoId ? `https://www.youtube.com/watch?v=${currentVideoId}` : watchUrl(active))}
          >
            <Ionicons name="logo-youtube" size={15} color="#fff" />
            <Text style={ps.pillText}>YouTube</Text>
          </Pressable>
        </View>
      </View>

      {isPlaylist && (
        <View onLayout={e => { listOffsetRef.current = e.nativeEvent.layout.y; }}>
          <Text style={ps.sectionHeader}>Playlist · {listLoading ? '…' : countLabel(items.length, 'Video', 'Videos')}</Text>
          {listLoading
            ? [0, 1, 2, 3].map(i => <View key={i} style={ps.skeletonRow} />)
            : items.map((item, i) => {
                const isCurrent = item.videoId === currentVideoId;
                return (
                  <Pressable
                    key={item.videoId}
                    onLayout={e => rowYRef.current.set(item.videoId, e.nativeEvent.layout.y)}
                    style={[ps.row, isCurrent && ps.rowActive]}
                    onPress={() => { setCurrentVideoId(item.videoId); setPlayerError(null); }}
                  >
                    <Text style={[ps.rowIndex, isCurrent && ps.rowIndexActive]}>{isCurrent ? '▶' : i + 1}</Text>
                    <Image source={{ uri: absoluteApiUrl(item.thumbnail) }} style={ps.rowThumb} />
                    <Text style={[ps.rowTitle, isCurrent && ps.rowTitleActive]} numberOfLines={2}>{item.title}</Text>
                  </Pressable>
                );
              })}
        </View>
      )}

      {related.length > 0 && (
        <View>
          <Text style={ps.sectionHeader}>Weitere Videos</Text>
          {related.map(v => <RelatedRow key={v.id} video={v} onPress={() => switchTo(v)} />)}
        </View>
      )}
    </ScrollView>
  );

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={ps.modal}>
        <View style={[ps.header, { paddingTop: Math.max(insets.top, spacing.sm), height: headerHeight }]}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Schließen">
            <Ionicons name="chevron-down" size={26} color="#fff" />
          </Pressable>
          <Text style={ps.headerTitle} numberOfLines={1}>{title}</Text>
          {isPlaylist && (
            <>
              <Pressable onPress={() => go(-1)} disabled={!hasPrev} hitSlop={8} style={!hasPrev && ps.iconDisabled} accessibilityLabel="Vorheriges Video">
                <Ionicons name="play-skip-back" size={20} color="#fff" />
              </Pressable>
              <Pressable onPress={() => go(1)} disabled={!hasNext} hitSlop={8} style={!hasNext && ps.iconDisabled} accessibilityLabel="Nächstes Video">
                <Ionicons name="play-skip-forward" size={20} color="#fff" />
              </Pressable>
            </>
          )}
          {!landscapePhone && (
            <Pressable onPress={() => setPanelHidden(h => !h)} hitSlop={8} accessibilityLabel={panelHidden ? 'Liste einblenden' : 'Liste ausblenden'}>
              <Ionicons name={panelHidden ? 'list' : 'expand-outline'} size={21} color="#fff" />
            </Pressable>
          )}
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Schließen">
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>

        {showPanel && wide ? (
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <View style={{ width: videoW, justifyContent: 'flex-start' }}>{videoBox}</View>
            {panel}
          </View>
        ) : showPanel ? (
          <View style={{ flex: 1 }}>
            {videoBox}
            {panel}
          </View>
        ) : (
          videoBox
        )}
      </View>
    </Modal>
  );
}

function RelatedRow({ video, onPress }: { video: VideoEntry; onPress: () => void }) {
  const items = usePlaylistItems(video.type === 'PLAYLIST' && !video.thumbnailUrl ? video.youtubeId : null);
  const thumb = thumbnailFor(video) ?? (items && items[0] ? absoluteApiUrl(items[0].thumbnail) : null);
  return (
    <Pressable style={ps.row} onPress={onPress}>
      <View style={ps.relatedThumb}>
        {thumb ? <Image source={{ uri: thumb }} style={{ width: '100%', height: '100%' }} /> : (
          <View style={ps.centerFill}><Ionicons name="albums-outline" size={18} color="rgba(255,255,255,0.5)" /></View>
        )}
        {video.type === 'PLAYLIST' && (
          <View style={ps.relatedBadge}>
            <Ionicons name="list" size={10} color="#fff" />
            <Text style={ps.relatedBadgeText}>Playlist</Text>
          </View>
        )}
      </View>
      <Text style={ps.rowTitle} numberOfLines={3}>{video.title}</Text>
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surfaceMuted },
    scrollContent: { paddingBottom: spacing.xl },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.surfaceMuted },
    disabled: { opacity: 0.4 },

    stickyNav: { backgroundColor: colors.surfaceMuted, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingTop: spacing.md },
    navInner: { alignSelf: 'center' },
    catRow: { flexDirection: 'row', gap: spacing.sm },
    catChip: {
      flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 9, paddingHorizontal: 6, borderRadius: radius.md,
      alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    catChipActive: { backgroundColor: colors.primary600, borderColor: colors.primary600 },
    catChipText: { fontFamily: font.medium, fontSize: 13, color: colors.textMuted },
    catChipTextActive: { color: '#fff', fontFamily: font.semiBold },

    chipRow: { gap: spacing.xs + 2, paddingVertical: spacing.sm + 2, alignItems: 'center' },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    chipActive: { backgroundColor: colors.text, borderColor: colors.text },
    chipText: { fontFamily: font.medium, fontSize: 14, color: colors.textMuted },
    chipTextActive: { color: colors.background, fontFamily: font.semiBold },

    subChipRow: { gap: spacing.xs + 2, paddingTop: spacing.md, alignItems: 'center' },
    subChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: 'transparent' },
    subChipActive: { backgroundColor: colors.primary50, borderColor: colors.primary600 },
    subChipText: { fontFamily: font.medium, fontSize: 13, color: colors.textMuted },
    subChipTextActive: { color: colors.primary700, fontFamily: font.semiBold },

    titleBar: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.md,
      backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, paddingHorizontal: spacing.md,
    },
    backButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
    titleAccent: { width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: colors.primary600 },
    titleText: { fontFamily: font.semiBold, fontSize: 16, color: colors.text },
    titleMeta: { fontFamily: font.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },

    thumbWrap: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    thumbImage: { width: '100%', height: '100%' },
    thumbPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
    playBadge: {
      position: 'absolute', bottom: 6, right: 6, width: 28, height: 28, borderRadius: 14,
      backgroundColor: 'rgba(220,38,38,0.92)', alignItems: 'center', justifyContent: 'center',
    },
    countOverlay: {
      position: 'absolute', top: 0, right: 0, bottom: 0, width: '32%',
      backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', justifyContent: 'center', gap: 2,
    },
    countOverlayText: { color: '#fff', fontFamily: font.semiBold, fontSize: 15 },
    cardTextRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    groupTitle: { flex: 1, fontFamily: font.semiBold, fontSize: 15, color: colors.text },
    cardMeta: { fontFamily: font.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
    videoTitle: { fontFamily: font.medium, fontSize: 13, color: colors.text, marginTop: 6 },

    sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm, marginTop: spacing.xs },
    sectionLabel: { fontFamily: font.semiBold, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textFaint },
    yearDivider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    yearDividerText: { fontFamily: font.bold, fontSize: 13, letterSpacing: 1, color: colors.textFaint },
    yearDividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },

    playlistCard: {
      backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
      padding: spacing.md, marginBottom: spacing.lg,
    },
    playlistHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
    playlistCover: { width: 96, height: 54, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
    playlistTitle: { fontFamily: font.semiBold, fontSize: 15, color: colors.text },
    playlistActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.md },

    primaryButton: {
      flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary600,
      borderRadius: radius.full, paddingVertical: 9, paddingHorizontal: spacing.md, marginTop: spacing.xs,
    },
    primaryButtonText: { color: '#fff', fontFamily: font.semiBold, fontSize: 14 },
    ghostButton: {
      flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
      paddingVertical: 8, paddingHorizontal: spacing.md, marginTop: spacing.xs,
    },
    ghostButtonText: { color: colors.textMuted, fontFamily: font.medium, fontSize: 14 },

    itemRow: { flexDirection: 'row', gap: spacing.sm + 4, alignItems: 'center', paddingVertical: 6 },
    itemThumb: { width: 128, height: 72, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
    itemTitle: { flex: 1, fontFamily: font.medium, fontSize: 14, color: colors.text },
    indexBadge: {
      position: 'absolute', left: 4, bottom: 4, minWidth: 20, paddingHorizontal: 5, height: 18, borderRadius: 4,
      backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center',
    },
    indexBadgeText: { color: '#fff', fontFamily: font.semiBold, fontSize: 11 },
    skeletonRow: { height: 72, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
    moreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: spacing.md },
    moreButtonText: { fontFamily: font.semiBold, fontSize: 14, color: colors.primary700 },

    emptyBox: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.lg },
    emptyTitle: { color: colors.text, fontFamily: font.semiBold, fontSize: 16, textAlign: 'center', marginTop: spacing.sm },
    emptyText: { color: colors.textMuted, fontFamily: font.regular, fontSize: 13, textAlign: 'center' },
  });
}

// Player bleibt unabhängig vom App-Theme dunkel (wie YouTube).
const ps = StyleSheet.create({
  modal: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md },
  headerTitle: { flex: 1, color: '#fff', fontFamily: font.semiBold, fontSize: 15 },
  iconDisabled: { opacity: 0.3 },
  webview: { flex: 1, backgroundColor: '#000' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  hint: { color: 'rgba(255,255,255,0.6)', fontFamily: font.regular, fontSize: 13, textAlign: 'center' },
  errorTitle: { color: '#fff', fontFamily: font.semiBold, fontSize: 16, textAlign: 'center' },
  youtubeButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: '#dc2626',
    borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: spacing.lg, marginTop: spacing.sm,
  },
  youtubeButtonText: { color: '#fff', fontFamily: font.semiBold, fontSize: 14 },
  skip: { color: 'rgba(255,255,255,0.7)', fontFamily: font.medium, fontSize: 13, marginTop: spacing.sm },

  panel: { flex: 1, backgroundColor: '#0f0f0f' },
  info: { padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.12)' },
  infoTitle: { color: '#fff', fontFamily: font.semiBold, fontSize: 17 },
  infoMeta: { color: 'rgba(255,255,255,0.6)', fontFamily: font.regular, fontSize: 13, marginTop: 4 },
  infoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: 14,
  },
  pillDisabled: { opacity: 0.35 },
  pillText: { color: '#fff', fontFamily: font.medium, fontSize: 13 },

  sectionHeader: {
    color: 'rgba(255,255,255,0.55)', fontFamily: font.semiBold, fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 0.6, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs,
  },
  skeletonRow: { height: 54, marginHorizontal: spacing.md, marginVertical: 4, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.06)' },
  row: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 6, alignItems: 'center' },
  rowActive: { backgroundColor: 'rgba(22,163,74,0.22)' },
  rowIndex: { width: 20, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontFamily: font.medium, fontSize: 12 },
  rowIndexActive: { color: '#4ade80' },
  rowThumb: { width: 96, height: 54, borderRadius: radius.sm, backgroundColor: '#222' },
  rowTitle: { flex: 1, color: 'rgba(255,255,255,0.88)', fontFamily: font.medium, fontSize: 13 },
  rowTitleActive: { color: '#fff', fontFamily: font.semiBold },
  relatedThumb: { width: 128, height: 72, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: '#222' },
  relatedBadge: {
    position: 'absolute', right: 4, bottom: 4, flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  relatedBadgeText: { color: '#fff', fontFamily: font.semiBold, fontSize: 10 },
});
