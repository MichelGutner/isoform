/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { ITEM_PROPS, usePlaylist, useRestartOnSameSource, type PlaylistItem } from '../../../../core/playlist';

/**
 * Lists on mobile: `Video`, `Audio` and `Pdf` with `items` get a "playlist" button
 * inside the native player. It opens a dark panel over the player with a
 * center-focused carousel: the card in the middle is full size and highlighted,
 * its neighbors shrink and fade with the distance (animated on the native thread
 * while scrolling), it snaps to a card, and the card it stops on becomes the
 * selected entry. Tapping a card picks it and closes the panel.
 * The player itself is unchanged, and the component's style still goes to it.
 */

type Kind = 'Video' | 'Audio' | 'Pdf';

const LIST_PROPS = ['items', 'initialIndex', 'carousel', 'autoAdvance', 'onItemChange'] as const;

const withoutList = (props: Record<string, any>) => {
  const rest = { ...props };
  LIST_PROPS.forEach((key) => delete rest[key]);
  return rest;
};

const NO_LIST = { next: () => undefined, previous: () => undefined, goTo: () => undefined };

/** A `ref` that has the list methods and forwards everything else to the player. */
const handleOf = (inner: React.RefObject<any>, list: Record<string, (...args: any[]) => void>) =>
  new Proxy(list, {
    get: (target, key: string) => target[key] ?? ((...args: any[]) => inner.current?.[key]?.(...args)),
  });

/** Card width and image shape per kind. */
const CARD: Record<Kind, { width: number; ratio: number; radius: number }> = {
  Video: { width: 150, ratio: 16 / 9, radius: 12 },
  Audio: { width: 76, ratio: 1, radius: 10 },
  Pdf: { width: 84, ratio: 3 / 4, radius: 7 },
};
const GAP = 14;

/** The panel is always dark glass (it sits over videos, covers and pages). */
const PANEL = { fg: '#ffffff', muted: 'rgba(235,235,245,0.62)', card: 'rgba(255,255,255,0.12)', ring: '#ffffff', nav: 'rgba(255,255,255,0.14)' };
type Colors = typeof PANEL;

const imageOf = (kind: Kind, item: any): string | undefined => ({ Video: item.poster, Audio: item.artwork, Pdf: item.thumbnail })[kind];

/** Placeholder art when the entry has no image. */
function Fallback({ kind, color }: { kind: Kind; color: string }) {
  const art: Record<Kind, React.ReactNode> = {
    Video: <Text style={[styles.glyph, { color }]}>▶</Text>,
    Audio: <Text style={[styles.glyph, { color }]}>♪</Text>,
    Pdf: (
      <View style={styles.doc}>
        {[1, 1, 1, 0.6].map((width, i) => (
          <View key={i} style={[styles.docLine, { backgroundColor: color, width: `${width * 100}%` }]} />
        ))}
      </View>
    ),
  };
  return <>{art[kind]}</>;
}

/** Three bars that bounce while the current entry plays ("now playing"). */
function NowPlaying({ playing }: { playing: boolean }) {
  const bars = useMemo(() => [0, 1, 2].map(() => new Animated.Value(0.4)), []);
  useEffect(() => {
    if (!playing) {
      bars.forEach((bar) => bar.setValue(0.4));
      return;
    }
    const loops = bars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(bar, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(bar, { toValue: 0.35, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [playing, bars]);
  return (
    <View style={styles.now} pointerEvents="none">
      {bars.map((bar, i) => (
        <Animated.View key={i} style={[styles.bar, { transform: [{ translateY: 5 }, { scaleY: bar }, { translateY: -5 }] }]} />
      ))}
    </View>
  );
}

interface StripProps {
  kind: Kind;
  items: PlaylistItem[];
  index: number;
  playing: boolean;
  /** Arrows and the card the scroll stops on. */
  onSelect(index: number): void;
  /** A tapped card. */
  onPick(index: number): void;
  /** The close button. */
  onClose(): void;
}

function Strip({ kind, items, index, playing, onSelect, onPick, onClose }: StripProps) {
  const colors: Colors = PANEL;
  const card = CARD[kind];
  const step = card.width + GAP;
  const [width, setWidth] = useState(0);
  const [focus, setFocus] = useState(index);
  const scroll = useRef<any>(null);
  const x = useRef(new Animated.Value(index * step)).current;
  const side = Math.max(0, (width - card.width) / 2);

  // the selected entry (from anywhere) glides to the center
  const ready = useRef(false);
  useEffect(() => {
    if (!width) return;
    setFocus(index);
    scroll.current?.scrollTo({ x: index * step, animated: ready.current });
    ready.current = true;
  }, [index, width, step]);

  const centered = (offset: number) => Math.min(items.length - 1, Math.max(0, Math.round(offset / step)));

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x } } }], {
        useNativeDriver: true,
        listener: (event: any) => setFocus(centered(event.nativeEvent.contentOffset.x)),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [x, step, items.length],
  );

  return (
    <View style={styles.strip} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.head}>
        <Text style={[styles.headTitle, { color: colors.fg }]} numberOfLines={1}>
          {items[focus]?.title ?? `Item ${focus + 1}`}
        </Text>
        <Text style={[styles.headCount, { color: colors.muted }]}>
          {focus + 1} / {items.length}
        </Text>
        <View style={styles.flex} />
        <NavButton label="Previous" glyph="‹" colors={colors} disabled={index === 0} onPress={() => onSelect(index - 1)} />
        <NavButton label="Next" glyph="›" colors={colors} disabled={index === items.length - 1} onPress={() => onSelect(index + 1)} />
        <NavButton label="Close playlist" glyph="✕" colors={colors} disabled={false} onPress={onClose} small />
      </View>
      <Animated.ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={(e: any) => onSelect(centered(e.nativeEvent.contentOffset.x))}
        contentContainerStyle={{ paddingHorizontal: side, paddingVertical: 12, gap: GAP }}
        accessibilityRole="adjustable"
        accessibilityLabel="Playlist"
      >
        {items.map((item, i) => {
          const range = [(i - 1) * step, i * step, (i + 1) * step];
          const scale = x.interpolate({ inputRange: range, outputRange: [0.84, 1, 0.84], extrapolate: 'clamp' });
          const opacity = x.interpolate({ inputRange: range, outputRange: [0.5, 1, 0.5], extrapolate: 'clamp' });
          const image = imageOf(kind, item);
          const focused = i === focus;
          return (
            <Pressable
              key={`${i}:${item.src}`}
              onPress={() => onPick(i)}
              accessibilityRole="button"
              accessibilityLabel={item.title ?? `Item ${i + 1}`}
              accessibilityState={{ selected: i === index }}
            >
              <Animated.View style={[styles.card, { width: card.width, opacity, transform: [{ scale }] }]}>
                <View
                  style={[
                    styles.thumb,
                    { aspectRatio: card.ratio, borderRadius: card.radius, backgroundColor: colors.card },
                    focused ? [styles.thumbFocused, { borderColor: colors.ring }] : null,
                  ]}
                >
                  <Fallback kind={kind} color={colors.muted} />
                  {image ? <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
                  {i === index && kind !== 'Pdf' ? <NowPlaying playing={playing} /> : null}
                </View>
                {item.title ? (
                  <Text numberOfLines={2} style={[styles.title, { color: focused ? colors.fg : colors.muted }, focused ? styles.titleFocused : null]}>
                    {item.title}
                  </Text>
                ) : null}
              </Animated.View>
            </Pressable>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
}

function NavButton({ label, glyph, colors, disabled, onPress, small = false }: { label: string; glyph: string; colors: Colors; disabled: boolean; onPress(): void; small?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.nav, { backgroundColor: colors.nav, opacity: disabled ? 0.3 : pressed ? 0.6 : 1 }]}
    >
      <Text style={[small ? styles.closeGlyph : styles.navGlyph, { color: colors.fg }]}>{glyph}</Text>
    </Pressable>
  );
}

/** Where the playlist button sits inside each player (clear of the native controls). */
const BUTTON_PLACE: Record<Kind, object> = {
  // video: top center (the native controls use the corners and the bottom)
  Video: { top: 10, left: 0, right: 0, alignItems: 'center' },
  // audio: a badge on the corner of the cover
  Audio: { top: 38, left: 18 },
  // PDF: top right of the pages, below the toolbar
  Pdf: { top: 62, right: 12 },
};

/** Idle time after which the video's controls (and our button) hide while playing. */
const HIDE_AFTER = 3000;

/**
 * Whether the button is shown, like the native video controls: always while paused;
 * while playing, for a few seconds after each touch. `touches` changes on every touch.
 */
function useControlsVisible(enabled: boolean, playing: boolean, touches: number) {
  const opacity = useRef(new Animated.Value(1)).current;
  // a hidden button must not take taps (the tap only brings the controls back)
  const [shown, setShown] = useState(true);
  useEffect(() => {
    setShown(true);
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    if (!enabled || !playing) return;
    const timer = setTimeout(() => {
      setShown(false);
      Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    }, HIDE_AFTER);
    return () => clearTimeout(timer);
  }, [enabled, playing, touches, opacity]);
  return { opacity, shown };
}

interface OverlayProps {
  kind: Kind;
  items: PlaylistItem[];
  index: number;
  playing: boolean;
  /** Changes on every touch on the player (to show the button again). */
  touches: number;
  onSelect(index: number): void;
  /** Whether the panel is open. */
  open: boolean;
  setOpen(open: boolean): void;
  /** Whether the button floats over the player (only where the controls cannot take it). */
  floatingButton: boolean;
}

/**
 * The button is part of each player's native controls (iOS and Android, video,
 * audio and PDF). It only floats over the player when its controls are off.
 */
const floats = (controls: unknown) => controls === false;

/** The carousel panel over the player (and, on the iOS video, the floating button). */
function PlaylistOverlay({ kind, items, index, playing, touches, onSelect, open, setOpen, floatingButton }: OverlayProps) {
  // only the video hides its controls; the audio card and the PDF toolbar stay
  const visible = useControlsVisible(kind === 'Video', playing, touches);
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!open) return;
    rise.setValue(0);
    Animated.timing(rise, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [open, rise]);
  const compact = kind === 'Audio';
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {open ? (
        <Animated.View
          style={[
            styles.panel,
            compact ? styles.panelFull : null,
            { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] },
          ]}
          accessibilityViewIsModal
        >
          <Strip
            kind={kind}
            items={items}
            index={index}
            playing={playing}
            onSelect={onSelect}
            onPick={(i) => {
              onSelect(i);
              setOpen(false);
            }}
            onClose={() => setOpen(false)}
          />
        </Animated.View>
      ) : floatingButton ? (
        <Animated.View style={[styles.place, BUTTON_PLACE[kind], { opacity: visible.opacity }]} pointerEvents={visible.shown ? 'box-none' : 'none'}>
          <Pressable
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Playlist, item ${index + 1} of ${items.length}`}
            hitSlop={8}
            style={({ pressed }) => [styles.open, compact ? styles.openSmall : null, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
          >
            <View style={styles.listIcon}>
              {[0, 1, 2].map((row) => (
                <View key={row} style={styles.listRow}>
                  <View style={styles.listDot} />
                  <View style={styles.listLine} />
                </View>
              ))}
            </View>
            <Text style={[styles.openText, compact ? styles.openTextSmall : null]}>
              {index + 1}/{items.length}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** The player with its list: current entry, carousel and auto-advance. */
function ListPlayer({ kind, Player, props, handle }: { kind: Kind; Player: React.ComponentType<any>; props: Record<string, any>; handle: React.Ref<any> }) {
  const { items, initialIndex, carousel = true, autoAdvance = true, onItemChange, ...rest } = props;
  const list = usePlaylist(items as PlaylistItem[], initialIndex, onItemChange);
  const inner = useRef<any>(null);
  const playing = useRef(false);
  useRestartOnSameSource(items, list.index, list.autoPlay, inner);
  const [isPlaying, setPlaying] = useState(false);
  const [touches, setTouches] = useState(0);
  const [open, setOpen] = useState(false);

  useImperativeHandle(
    handle,
    () => handleOf(inner, { next: () => list.next(playing.current), previous: () => list.previous(playing.current), goTo: (i: number) => list.goTo(i, playing.current) }),
    [list],
  );

  const media = {
    autoPlay: list.autoPlay || rest.autoPlay,
    onPlay: () => {
      playing.current = true;
      setPlaying(true);
      rest.onPlay?.();
    },
    onPause: () => {
      playing.current = false;
      setPlaying(false);
      rest.onPause?.();
    },
    onEnded: () => {
      playing.current = false;
      setPlaying(false);
      rest.onEnded?.();
      if (autoAdvance && list.index < items.length - 1) list.next(true);
    },
  };

  return (
    <Player
      ref={inner}
      {...rest}
      {...(kind === 'Pdf' ? {} : media)}
      {...ITEM_PROPS[kind](list.item)}
      onPlayerTouch={floats(rest.controls) ? () => setTouches((n) => n + 1) : undefined}
      playlist={
        carousel
          ? {
              index: list.index,
              count: items.length,
              onPress: () => setOpen(true),
              // for the carousel the video draws itself in fullscreen
              items: (items as PlaylistItem[]).map((item) => ({ title: item.title ?? '', image: imageOf(kind, item) ?? '' })),
              onSelect: (i: number) => list.goTo(i, playing.current),
            }
          : undefined
      }
      overlay={
        carousel ? (
          <PlaylistOverlay
            kind={kind}
            items={items}
            index={list.index}
            playing={isPlaying}
            touches={touches}
            onSelect={(i) => list.goTo(i, playing.current)}
            open={open}
            setOpen={setOpen}
            floatingButton={floats(rest.controls)}
          />
        ) : null
      }
    />
  );
}

/**
 * Adds `items` support to a mobile player. Without a list it renders the player
 * as before (the `ref` still has `next`/`previous`/`goTo`, as no-ops).
 */
export function withPlaylist(kind: Kind, Player: React.ComponentType<any>) {
  const Listed = forwardRef<any, any>((props, ref) => {
    const inner = useRef<any>(null);
    const hasList = Array.isArray(props.items) && props.items.length > 0;
    useImperativeHandle(hasList ? null : ref, () => handleOf(inner, NO_LIST), []);
    if (hasList) return <ListPlayer kind={kind} Player={Player} props={props} handle={ref} />;
    return <Player ref={inner} {...withoutList(props)} />;
  });
  Listed.displayName = kind;
  return Listed;
}

const styles = StyleSheet.create({
  strip: { gap: 2 },
  place: { position: 'absolute' },
  open: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingLeft: 9, paddingRight: 11, borderRadius: 15, backgroundColor: 'rgba(20,20,22,0.62)', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  openSmall: { height: 24, paddingLeft: 6, paddingRight: 7, gap: 4, borderRadius: 12 },
  openText: { color: '#fff', fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  openTextSmall: { fontSize: 11 },
  listIcon: { gap: 2.5 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 2.5 },
  listDot: { width: 2.5, height: 2.5, borderRadius: 1.25, backgroundColor: '#fff' },
  listLine: { width: 9, height: 1.8, borderRadius: 1, backgroundColor: '#fff' },
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '100%', paddingTop: 10, paddingBottom: 6, backgroundColor: 'rgba(16,16,18,0.88)' },
  panelFull: { top: 0, justifyContent: 'center' },
  closeGlyph: { fontSize: 14, fontWeight: '600' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 14, paddingRight: 8 },
  headTitle: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  headCount: { fontSize: 13, fontVariant: ['tabular-nums'] },
  flex: { flex: 1 },
  nav: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  navGlyph: { fontSize: 22, lineHeight: 24, marginTop: -2, fontWeight: '500' },
  card: { alignItems: 'center', gap: 8 },
  thumb: { width: '100%', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: 'transparent' },
  thumbFocused: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  glyph: { fontSize: 26 },
  doc: { width: '46%', gap: 5 },
  docLine: { height: 3, borderRadius: 2, opacity: 0.55 },
  title: { fontSize: 12.5, lineHeight: 16, textAlign: 'center' },
  titleFocused: { fontWeight: '600' },
  now: { position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 22, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)' },
  bar: { width: 3, height: 14, borderRadius: 2, backgroundColor: '#fff' },
});
