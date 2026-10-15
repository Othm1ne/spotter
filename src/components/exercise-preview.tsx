import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius } from '@/constants/theme';
import { gifUrl } from '@/db/exercise-guides';

/** Looping animation of the exercise with the worked muscles highlighted. */
export function ExercisePreview({ gif, style }: { gif: string | null; style?: StyleProp<ViewStyle> }) {
  if (!gif) {
    return (
      <View style={[styles.box, styles.empty, style]}>
        <Text style={styles.emptyText}>No preview for this exercise</Text>
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
  return (
    <View style={[styles.thumb, { width: size, height: size }, !gif && { backgroundColor: Colors.surfaceRaised }]}>
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

const styles = StyleSheet.create({
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
  empty: { backgroundColor: Colors.surface, aspectRatio: 4 / 3 },
  emptyText: { color: Colors.textSecondary },
  thumb: {
    borderRadius: Radius.sm,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbLetter: { color: Colors.textSecondary, fontSize: 20, fontWeight: '700' },
});
