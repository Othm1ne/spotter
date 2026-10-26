import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import type { IconName } from '@/components/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useSpotify } from '@/hooks/use-spotify';
import { useT } from '@/i18n';
import { openSpotify } from '@/services/spotify';
import { makeStyles, useColors } from '@/theme';

/** Spotify's brand green, for its logo only. */
const SPOTIFY_GREEN = '#1DB954';

/**
 * Now-playing card with play/pause and skip, like the music player in navigation apps.
 * Hidden when Spotify isn't set up for this build.
 */
export function MusicCard() {
  const c = useColors();
  const styles = useStyles();
  const t = useT();
  const spotify = useSpotify();
  const { now } = spotify;
  const clock = useNow(Boolean(now?.isPlaying));

  if (!spotify.configured || spotify.connected === null) return null;

  if (!spotify.connected) {
    return (
      <Pressable onPress={spotify.connect} disabled={spotify.busy} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
        <View style={styles.logo}>
          <FontAwesome name="spotify" size={26} color={SPOTIFY_GREEN} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('music.connectTitle')}</Text>
          <Text style={styles.sub} numberOfLines={2}>
            {spotify.error ? t(`music.error.${spotify.error}`) : t('music.connectBody')}
          </Text>
        </View>
        {spotify.busy ? <ActivityIndicator color={c.accent} /> : <Text style={styles.action}>{t('music.connect')}</Text>}
      </Pressable>
    );
  }

  if (!now) {
    return (
      <Pressable onPress={() => openSpotify()} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
        <View style={styles.logo}>
          <FontAwesome name="spotify" size={26} color={SPOTIFY_GREEN} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('music.nothing')}</Text>
          <Text style={styles.sub}>{t('music.nothingBody')}</Text>
        </View>
        <Text style={styles.action}>{t('music.open')}</Text>
      </Pressable>
    );
  }

  const elapsed = now.isPlaying ? now.progressMs + (clock - now.measuredAt) : now.progressMs;
  const progress = now.durationMs ? Math.min(1, elapsed / now.durationMs) : 0;
  const premium = spotify.account?.premium ?? false;

  function press(action: 'play' | 'pause' | 'next' | 'previous') {
    Haptics.selectionAsync();
    spotify.control(action);
  }

  return (
    <View style={styles.card}>
      <Pressable onPress={() => openSpotify()} style={styles.info} accessibilityLabel={t('music.openTrack', { title: now.title })}>
        {now.image ? (
          <Image source={now.image} style={styles.cover} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.cover, styles.logo]}>
            <Ionicons name="musical-notes" size={22} color={c.textSecondary} />
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.titleRow}>
            <FontAwesome name="spotify" size={13} color={SPOTIFY_GREEN} />
            <Text style={styles.title} numberOfLines={1}>
              {now.title}
            </Text>
          </View>
          <Text style={styles.sub} numberOfLines={1}>
            {spotify.error ? t(`music.error.${spotify.error}`) : now.artists}
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
      </Pressable>
      {premium ? (
        <View style={styles.controls}>
          <Control icon="play-skip-back" label={t('music.previous')} onPress={() => press('previous')} />
          <Pressable
            onPress={() => press(now.isPlaying ? 'pause' : 'play')}
            style={styles.playButton}
            accessibilityLabel={now.isPlaying ? t('music.pause') : t('music.play')}>
            <Ionicons name={now.isPlaying ? 'pause' : 'play'} size={22} color={c.accentText} />
          </Pressable>
          <Control icon="play-skip-forward" label={t('music.next')} onPress={() => press('next')} />
        </View>
      ) : (
        <Pressable onPress={() => openSpotify()} hitSlop={8}>
          <Text style={styles.action}>{t('music.open')}</Text>
        </Pressable>
      )}
    </View>
  );
}

function Control({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.controlButton} accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={c.text} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: c.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: Spacing.md,
  },
  info: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  logo: { width: 48, height: 48, borderRadius: Radius.md, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  cover: { width: 52, height: 52, borderRadius: Radius.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: c.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  sub: { color: c.textSecondary, fontSize: 13 },
  action: { color: c.accent, fontSize: 15, fontWeight: '700' },
  track: { height: 3, borderRadius: 2, backgroundColor: c.surfaceRaised, marginTop: 6, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2, backgroundColor: c.text },
  controls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  controlButton: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  playButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
}));
