import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  connectSpotify,
  controlPlayback,
  disconnectSpotify,
  getNowPlaying,
  getSpotifyAccount,
  isSpotifyConnected,
  SpotifyError,
  spotifyConfigured,
  type NowPlaying,
  type SpotifyErrorKind,
} from '@/services/spotify';

const POLL_MS = 5000;

export type SpotifyState = {
  /** null while checking. */
  connected: boolean | null;
  account: { name: string; premium: boolean } | null;
  now: NowPlaying | null;
  error: SpotifyErrorKind | null;
  busy: boolean;
};

// Shared by every screen that shows the player, so switching screens doesn't flash empty.
let shared: SpotifyState = { connected: null, account: null, now: null, error: null, busy: false };
const listeners = new Set<(s: SpotifyState) => void>();

function update(patch: Partial<SpotifyState>) {
  shared = { ...shared, ...patch };
  for (const l of listeners) l(shared);
}

function kindOf(e: unknown): SpotifyErrorKind {
  return e instanceof SpotifyError ? e.kind : 'failed';
}

async function refresh() {
  if (!spotifyConfigured) return;
  try {
    const connected = await isSpotifyConnected();
    if (!connected) return update({ connected: false, account: null, now: null });
    const account = shared.account ?? (await getSpotifyAccount());
    update({ connected: true, account, now: await getNowPlaying(), error: null });
  } catch (e) {
    const kind = kindOf(e);
    // A refused refresh means the login expired or was revoked: show "Connect" again.
    if (kind === 'denied') update({ connected: false, account: null, now: null });
    else update({ error: kind });
  }
}

/** Spotify connection and what's playing, refreshed every few seconds while the screen is open. */
export function useSpotify() {
  const [state, setState] = useState(shared);

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!spotifyConfigured) return;
      refresh();
      const timer = setInterval(() => {
        if (AppState.currentState === 'active' && shared.connected) refresh();
      }, POLL_MS);
      return () => clearInterval(timer);
    }, [])
  );

  const connect = useCallback(async () => {
    update({ busy: true, error: null });
    try {
      await connectSpotify();
      update({ account: null });
      await refresh();
    } catch (e) {
      if (kindOf(e) !== 'cancelled') update({ error: kindOf(e) });
    } finally {
      update({ busy: false });
    }
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectSpotify();
    update({ connected: false, account: null, now: null, error: null });
  }, []);

  const control = useCallback(async (action: 'play' | 'pause' | 'next' | 'previous') => {
    // Show the change at once; the next poll confirms it.
    if (shared.now && (action === 'play' || action === 'pause')) {
      update({ now: { ...shared.now, isPlaying: action === 'play', measuredAt: Date.now() } });
    }
    try {
      await controlPlayback(action);
      update({ error: null });
      setTimeout(refresh, 700);
    } catch (e) {
      update({ error: kindOf(e) });
      refresh();
    }
  }, []);

  return { ...state, configured: spotifyConfigured, connect, disconnect, control };
}
