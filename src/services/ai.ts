/**
 * Client for the Spotter AI relay (worker/). The relay holds the Groq key; the app only knows the
 * relay URL and a shared app token, both from .env (EXPO_PUBLIC_ variables are inlined at build).
 */

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type AiErrorKind = 'not_configured' | 'offline' | 'rate_limited' | 'failed';

export class AiError extends Error {
  constructor(public kind: AiErrorKind) {
    super(kind);
  }
}

const URL = process.env.EXPO_PUBLIC_AI_URL;
const TOKEN = process.env.EXPO_PUBLIC_AI_TOKEN;
const TIMEOUT_MS = 45_000;

export const aiConfigured = Boolean(URL && TOKEN);

export async function aiChat(
  messages: ChatMessage[],
  options: { json?: boolean; maxTokens?: number } = {}
): Promise<string> {
  if (!URL || !TOKEN) throw new AiError('not_configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${URL}/v1/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-spotter-token': TOKEN },
      body: JSON.stringify({ messages, json: options.json, maxTokens: options.maxTokens }),
      signal: controller.signal,
    });
  } catch {
    throw new AiError('offline');
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 429) throw new AiError('rate_limited');
  if (!response.ok) throw new AiError('failed');
  const data = (await response.json()) as { content?: string };
  if (!data.content) throw new AiError('failed');
  return data.content;
}

export function aiErrorMessage(error: unknown): string {
  const kind = error instanceof AiError ? error.kind : 'failed';
  switch (kind) {
    case 'not_configured':
      return 'The AI coach is not set up on this build yet.';
    case 'offline':
      return "Couldn't reach the coach. Check your connection and try again.";
    case 'rate_limited':
      return 'The coach is busy right now (free plan limit). Try again in a minute.';
    default:
      return 'Something went wrong. Try again.';
  }
}
