import { router } from 'expo-router';
import { useEffect } from 'react';

/**
 * Where the Spotify login returns. The login sheet normally catches this link itself; if the
 * system opens the app with it instead, just go back to where the user was.
 */
export default function SpotifyAuthReturn() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);
  return null;
}
