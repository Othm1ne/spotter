/**
 * Spotify: sign in with PKCE (no secret in the app), read what is playing and control playback.
 *
 * Spotify only accepts registered HTTPS redirect URLs, so the login returns to the Spotter relay
 * (worker/), which forwards the code to this app's URL. The refresh token stays in the phone's
 * secure storage. Playback controls need Spotify Premium; reading what is playing does not.
 */
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
const RELAY = process.env.EXPO_PUBLIC_AI_URL;
const REDIRECT_URI = `${RELAY}/spotify/callback`;
const SCOPES = ['user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing', 'user-read-private'];
const REFRESH_KEY = 'spotify_refresh_token';
const API = 'https://api.spotify.com/v1';

export const spotifyConfigured = Boolean(CLIENT_ID && RELAY);

export type SpotifyErrorKind = 'not_configured' | 'cancelled' | 'denied' | 'premium' | 'no_device' | 'offline' | 'failed';

export class SpotifyError extends Error {
  constructor(public kind: SpotifyErrorKind) {
    super(kind);
  }
}

export type NowPlaying = {
  isPlaying: boolean;
  title: string;
  artists: string;
  image: string | null;
  progressMs: number;
  durationMs: number;
  /** spotify: URI, opens the track in the Spotify app. */
  uri: string | null;
  /** When `progressMs` was measured, to move the progress bar between polls. */
  measuredAt: number;
};

let session: { accessToken: string; expiresAt: number } | null = null;

function base64Url(base64: string) {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function form(values: Record<string, string>) {
  return Object.entries(values)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

async function tokenRequest(values: Record<string, string>) {
  let response: Response;
  try {
    response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form({ client_id: CLIENT_ID!, ...values }),
    });
  } catch {
    throw new SpotifyError('offline');
  }
  if (!response.ok) throw new SpotifyError(response.status === 400 ? 'denied' : 'failed');
  const data = (await response.json()) as { access_token: string; expires_in: number; refresh_token?: string };
  session = { accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  // Spotify may rotate the refresh token; keep the newest.
  if (data.refresh_token) await SecureStore.setItemAsync(REFRESH_KEY, data.refresh_token);
}

/** Opens the Spotify login and stores the session. Throws SpotifyError('cancelled') if closed. */
export async function connectSpotify() {
  if (!spotifyConfigured) throw new SpotifyError('not_configured');
  const verifier = base64Url(bytesToBase64(Crypto.getRandomBytes(64)));
  const challenge = base64Url(
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 })
  );
  const nonce = base64Url(bytesToBase64(Crypto.getRandomBytes(12)));
  const returnUrl = Linking.createURL('spotify-auth');
  const state = base64Url(btoa(JSON.stringify({ r: returnUrl, n: nonce })));
  const authUrl =
    'https://accounts.spotify.com/authorize?' +
    form({
      client_id: CLIENT_ID!,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      scope: SCOPES.join(' '),
      state,
    });

  const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);
  if (result.type !== 'success') throw new SpotifyError('cancelled');
  const params = Linking.parse(result.url).queryParams ?? {};
  // The state must be the one we sent: it proves this login was started here.
  if (params.state !== state) throw new SpotifyError('failed');
  if (params.error || typeof params.code !== 'string') throw new SpotifyError('denied');
  await tokenRequest({ grant_type: 'authorization_code', code: params.code, redirect_uri: REDIRECT_URI, code_verifier: verifier });
}

export async function disconnectSpotify() {
  session = null;
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export async function isSpotifyConnected() {
  return spotifyConfigured && (await SecureStore.getItemAsync(REFRESH_KEY)) !== null;
}

async function accessToken(): Promise<string> {
  if (session && session.expiresAt > Date.now()) return session.accessToken;
  const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refresh) throw new SpotifyError('denied');
  await tokenRequest({ grant_type: 'refresh_token', refresh_token: refresh });
  return session!.accessToken;
}

async function api(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const token = await accessToken();
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, { ...init, headers: { ...init.headers, authorization: `Bearer ${token}` } });
  } catch {
    throw new SpotifyError('offline');
  }
  if (response.status === 401 && retry) {
    session = null;
    return api(path, init, false);
  }
  if (response.status === 403) throw new SpotifyError('premium');
  if (response.status === 404) throw new SpotifyError('no_device');
  if (!response.ok && response.status !== 204) throw new SpotifyError('failed');
  return response;
}

export async function getSpotifyAccount(): Promise<{ name: string; premium: boolean }> {
  const me = (await (await api('/me')).json()) as { display_name?: string; id: string; product?: string };
  return { name: me.display_name || me.id, premium: me.product === 'premium' };
}

type Cover = { url: string; width?: number | null };

/** What is playing on any of the user's devices, or null. */
export async function getNowPlaying(): Promise<NowPlaying | null> {
  const response = await api('/me/player?additional_types=episode');
  if (response.status === 204) return null;
  const data = (await response.json()) as {
    is_playing: boolean;
    progress_ms: number | null;
    item: {
      name: string;
      uri: string;
      duration_ms: number;
      artists?: { name: string }[];
      album?: { images: Cover[] };
      show?: { name: string; images: Cover[] };
    } | null;
  };
  if (!data.item) return null;
  const images = data.item.album?.images ?? data.item.show?.images ?? [];
  return {
    isPlaying: data.is_playing,
    title: data.item.name,
    artists: data.item.artists?.map((a) => a.name).join(', ') ?? data.item.show?.name ?? '',
    // Spotify lists covers largest first (640, 300, 64 px): 300 px is sharp in a small cover.
    image: (images.find((i) => (i.width ?? 300) <= 320) ?? images[0])?.url ?? null,
    progressMs: data.progress_ms ?? 0,
    durationMs: data.item.duration_ms,
    uri: data.item.uri,
    measuredAt: Date.now(),
  };
}

export async function controlPlayback(action: 'play' | 'pause' | 'next' | 'previous') {
  const method = action === 'play' || action === 'pause' ? 'PUT' : 'POST';
  await api(`/me/player/${action}`, { method });
}

/** Opens the Spotify app (on the current track when there is one), or the website. */
export async function openSpotify(uri?: string | null) {
  try {
    await Linking.openURL(uri ?? 'spotify:');
  } catch {
    await Linking.openURL('https://open.spotify.com');
  }
}
