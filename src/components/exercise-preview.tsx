import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useT } from '@/i18n';
import { Radius } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';
import { gifUrl } from '@/db/exercise-guides';

/** Looping animation of the exercise with the worked muscles highlighted. */
export function ExercisePreview({ gif, style }: { gif: string | null; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const styles = useStyles();
  if (!gif) {
    return (
      <View style={[styles.box, styles.empty, style]}>
        <Text style={styles.emptyText}>{t('exercise.noPreview')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.box, style]}>
      <Image source={gifUrl(gif)} style={styles.gif} contentFit="contain" transition={200} />
    </View>
  );
}

/** Small still frame for lists. */
export function ExerciseThumb({ gif, name, size = 52 }: { gif: string | null; name: string; size?: number }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.thumb, { width: size, height: size }, !gif && { backgroundColor: c.surfaceRaised }]}>
      {gif ? (
        <Image
          source={gifUrl(gif)}
          autoplay={false}
          recyclingKey={gif}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          transition={150}
        />
      ) : (
        <Text style={styles.thumbLetter}>{name.charAt(0)}</Text>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  // The GIFs have white backgrounds, so the frame is white too.
  box: {
    aspectRatio: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gif: { width: '100%', height: '100%' },
  empty: { backgroundColor: c.surface, aspectRatio: 4 / 3 },
  emptyText: { color: c.textSecondary },
  thumb: {
    borderRadius: Radius.sm,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbLetter: { color: c.textSecondary, fontSize: 20, fontWeight: '700' },
}));
