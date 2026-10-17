/**
 * Food lookups: Open Food Facts (free, open database of packaged foods; ODbL) for search and
 * barcodes, and the AI relay for estimating meals described in words.
 * Open Food Facts allows ~10 searches and ~15 product reads per minute, so search runs on submit,
 * never while typing.
 */
import { aiLanguageName, t } from '@/i18n';
import { ESTIMATE_PROMPT, foodFromOpenFoodFacts, parseEstimate, type EstimatedItem, type FoodInput } from '@/lib/food';

import { aiChat } from './ai';

const USER_AGENT = 'Spotter/1.0 (othmaneouhaddou91@gmail.com)';
const FIELDS = 'code,product_name,brands,nutriments,serving_quantity';
const TIMEOUT_MS = 15_000;

export class FoodApiError extends Error {
  constructor(public kind: 'offline' | 'busy' | 'failed') {
    super(kind);
  }
}

async function getJson(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
  } catch {
    throw new FoodApiError('offline');
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 429 || response.status === 503) throw new FoodApiError('busy');
  if (!response.ok && response.status !== 404) throw new FoodApiError('failed');
  return response.json();
}

export async function searchOpenFoodFacts(query: string): Promise<FoodInput[]> {
  const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(query)}&page_size=25&fields=${FIELDS}`;
  const data = (await getJson(url)) as { hits?: Parameters<typeof foodFromOpenFoodFacts>[0][] };
  const foods = (data.hits ?? []).map(foodFromOpenFoodFacts).filter((f): f is FoodInput => f !== null);
  // The same product often appears several times; keep the first of each name + brand.
  const seen = new Set<string>();
  return foods.filter((f) => {
    const key = `${f.name}|${f.brand}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Product for a scanned barcode, or null when Open Food Facts doesn't know it. */
export async function productByBarcode(barcode: string): Promise<FoodInput | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`;
  const data = (await getJson(url)) as { status?: number; product?: Parameters<typeof foodFromOpenFoodFacts>[0] };
  if (data.status !== 1 || !data.product) return null;
  return foodFromOpenFoodFacts({ ...data.product, code: barcode });
}

/** AI estimate of a meal described in words, one item per food. */
export async function estimateMeal(description: string): Promise<EstimatedItem[]> {
  const reply = await aiChat(
    [
      { role: 'system', content: `${ESTIMATE_PROMPT}
Write item names in ${aiLanguageName()}.` },
      { role: 'user', content: description },
    ],
    { json: true, maxTokens: 700 }
  );
  return parseEstimate(reply);
}

export function foodErrorMessage(error: unknown): string {
  const kind = error instanceof FoodApiError ? error.kind : 'failed';
  return t(`errors.food.${kind}`);
}
