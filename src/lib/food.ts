/** Food and meal math. Pure: no db, no network. Nutrients on foods are per 100 g. */

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEALS: { value: Meal; title: string; icon: string }[] = [
  { value: 'breakfast', title: 'Breakfast', icon: 'sunny' },
  { value: 'lunch', title: 'Lunch', icon: 'restaurant' },
  { value: 'dinner', title: 'Dinner', icon: 'moon' },
  { value: 'snack', title: 'Snacks', icon: 'cafe' },
];

export type Nutrients = { kcal: number; protein: number; carbs: number; fat: number };

export type FoodInput = Nutrients & {
  name: string;
  brand: string | null;
  barcode: string | null;
  servingG: number | null;
  source: 'off' | 'ai' | 'custom';
};

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

/** The meal you're most likely logging right now. */
export function mealForTime(date: Date): Meal {
  const h = date.getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h >= 18 && h < 23) return 'dinner';
  return 'snack';
}

export function mealTitle(meal: Meal): string {
  return MEALS.find((m) => m.value === meal)?.title ?? meal;
}

/** Nutrients in `grams` of a food given per 100 g. */
export function scale(per100: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  return { kcal: per100.kcal * f, protein: per100.protein * f, carbs: per100.carbs * f, fat: per100.fat * f };
}

export function sum(items: Nutrients[]): Nutrients {
  return items.reduce(
    (t, n) => ({ kcal: t.kcal + n.kcal, protein: t.protein + n.protein, carbs: t.carbs + n.carbs, fat: t.fat + n.fat }),
    ZERO
  );
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * Open Food Facts product → food, or null when it lacks usable nutrition.
 * Energy is taken in kcal, or converted from kJ when only that is given.
 */
export function foodFromOpenFoodFacts(p: {
  code?: string;
  product_name?: string;
  brands?: string | string[];
  nutriments?: Record<string, unknown>;
  serving_quantity?: unknown;
}): FoodInput | null {
  const n = p.nutriments ?? {};
  const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g']);
  const kcal = num(n['energy-kcal_100g']) ?? (kj !== null ? kj / 4.184 : null);
  const name = p.product_name?.trim();
  if (!name || kcal === null) return null;
  const brand = Array.isArray(p.brands) ? p.brands[0] : p.brands?.split(',')[0];
  const serving = num(p.serving_quantity);
  return {
    name,
    brand: brand?.trim() || null,
    barcode: p.code ?? null,
    kcal,
    protein: num(n['proteins_100g']) ?? 0,
    carbs: num(n['carbohydrates_100g']) ?? 0,
    fat: num(n['fat_100g']) ?? 0,
    servingG: serving && serving > 0 ? serving : null,
    source: 'off',
  };
}

export type EstimatedItem = Nutrients & { name: string; grams: number };

/**
 * Validates the AI's meal estimate. The AI gives per-100 g values (what nutrition tables list,
 * so it knows them best) and the grams eaten; the app does the multiplication. Malformed items
 * are dropped, and per-100 g calories that don't match the macros (protein and carbs 4 kcal/g,
 * fat 9 kcal/g) by more than 25% are recomputed from them.
 */
export function parseEstimate(json: string): EstimatedItem[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  const items = (data as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  const out: EstimatedItem[] = [];
  for (const raw of items) {
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    const grams = num(r.grams);
    const protein = Math.max(0, num(r.protein_100g) ?? 0);
    const carbs = Math.max(0, num(r.carbs_100g) ?? 0);
    const fat = Math.max(0, num(r.fat_100g) ?? 0);
    let kcal = num(r.kcal_100g);
    if (!name || grams === null || grams <= 0 || kcal === null || kcal < 0 || kcal > 900) continue;
    const fromMacros = protein * 4 + carbs * 4 + fat * 9;
    if (fromMacros > 0 && Math.abs(kcal - fromMacros) / fromMacros > 0.25) kcal = fromMacros;
    out.push({ name, grams, ...scale({ kcal, protein, carbs, fat }, grams) });
  }
  return out;
}

/** Per-100 g values for an estimated item, so it can be saved and reused like any food. */
export function per100(item: EstimatedItem): Nutrients {
  const f = 100 / item.grams;
  return { kcal: item.kcal * f, protein: item.protein * f, carbs: item.carbs * f, fat: item.fat * f };
}

export const ESTIMATE_PROMPT = `You estimate the nutrition of meals for a calorie tracking app.
Return JSON only, exactly in this shape:
{"items":[{"name":"string","grams":number,"kcal_100g":number,"protein_100g":number,"carbs_100g":number,"fat_100g":number}]}
Rules:
- One item per distinct food or drink in the description.
- "grams" is the amount eaten (for drinks, 1 ml = 1 g). Use the quantities given; when none is given, assume a typical single portion and put it in the name, e.g. "Rice (1 cup cooked)".
- The other values are PER 100 g of that food as eaten (cooked if cooked), from standard nutrition tables. The app multiplies them by the grams.
- Name items in the language of the description, short and clear.
- If the text is not food or drink, return {"items":[]}.`;
