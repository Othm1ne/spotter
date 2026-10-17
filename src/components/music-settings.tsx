import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ActivityIndicator, Alert } from 'react-native';

import { Row } from '@/components/settings-rows';
import { useSpotify } from '@/hooks/use-spotify';
import { useT } from '@/i18n';
import { useColors } from '@/theme';

/** One settings row for Spotify: connect, or show the account and disconnect on tap. */
export function MusicRow() {
  const c = useColors();
  const t = useT();
  const spotify = useSpotify();

  if (!spotify.configured) {
    return <Row icon="musical-notes" title="Spotify" subtitle={t('music.notSetUpBody')} value={t('common.off')} />;
  }

  if (spotify.connected) {
    return (
      <Row
        icon="musical-notes"
        title={t('music.connectedAs', { name: spotify.account?.name ?? 'Spotify' })}
        subtitle={spotify.account?.premium ? t('music.premium') : t('music.free')}
        right={<FontAwesome name="spotify" size={22} color="#1DB954" />}
        onPress={() =>
          Alert.alert(t('music.disconnectTitle'), t('music.disconnectBody'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('music.disconnect'), style: 'destructive', onPress: spotify.disconnect },
          ])
        }
      />
    );
  }

  return (
    <Row
      icon="musical-notes"
      title={t('music.connectTitle')}
      subtitle={spotify.error ? t(`music.error.${spotify.error}`) : t('music.connectBody')}
      onPress={spotify.connect}
      right={spotify.busy ? <ActivityIndicator color={c.accent} /> : undefined}
    />
  );
}
