import type { SQLiteDatabase } from 'expo-sqlite';

import { scale, type FoodInput, type Meal, type Nutrients } from '@/lib/food';

export type Food = Nutrients & {
  id: number;
  name: string;
  brand: string | null;
  barcode: string | null;
  serving_g: number | null;
  source: FoodInput['source'];
  favorite: number;
  last_grams: number | null;
  last_used_at: number | null;
};

export type FoodEntry = Nutrients & {
  id: number;
  day: string;
  meal: Meal;
  food_id: number | null;
  name: string;
  grams: number | null;
  created_at: number;
};

/** Saves a food, or updates the stored copy when the same barcode is already saved. Returns its id. */
export async function saveFood(db: SQLiteDatabase, food: FoodInput): Promise<number> {
  if (food.barcode) {
    const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM foods WHERE barcode = ?', food.barcode);
    if (existing) {
      await db.runAsync(
        `UPDATE foods SET name = ?, brand = ?, kcal = ?, protein = ?, carbs = ?, fat = ?, serving_g = ? WHERE id = ?`,
        food.name,
        food.brand,
        food.kcal,
        food.protein,
        food.carbs,
        food.fat,
        food.servingG,
        existing.id
      );
      return existing.id;
    }
  }
  const result = await db.runAsync(
    `INSERT INTO foods (name, brand, barcode, kcal, protein, carbs, fat, serving_g, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    food.name,
    food.brand,
    food.barcode,
    food.kcal,
    food.protein,
    food.carbs,
    food.fat,
    food.servingG,
    food.source,
    Date.now()
  );
  return result.lastInsertRowId;
}

export function getFood(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Food>('SELECT * FROM foods WHERE id = ?', id);
}

export function getFoodByBarcode(db: SQLiteDatabase, barcode: string) {
  return db.getFirstAsync<Food>('SELECT * FROM foods WHERE barcode = ?', barcode);
}

export async function setFavorite(db: SQLiteDatabase, id: number, favorite: boolean) {
  await db.runAsync('UPDATE foods SET favorite = ? WHERE id = ?', favorite ? 1 : 0, id);
}

/** Foods saved on the phone whose name or brand contains every word of the query. */
export function searchSavedFoods(db: SQLiteDatabase, query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return Promise.resolve([] as Food[]);
  const where = words.map(() => "(LOWER(name) LIKE ? OR LOWER(COALESCE(brand, '')) LIKE ?)").join(' AND ');
  return db.getAllAsync<Food>(
    `SELECT * FROM foods WHERE ${where} ORDER BY favorite DESC, last_used_at DESC LIMIT 20`,
    ...words.flatMap((w) => [`%${w}%`, `%${w}%`])
  );
}

/** What you usually log at this meal (most often, then most recent), plus favorites and recents. */
export async function getSuggestions(db: SQLiteDatabase, meal: Meal) {
  const [usual, favorites, recent] = await Promise.all([
    db.getAllAsync<Food>(
      `SELECT f.* FROM food_entries e JOIN foods f ON f.id = e.food_id
       WHERE e.meal = ?
       GROUP BY f.id
       ORDER BY COUNT(*) DESC, MAX(e.created_at) DESC
       LIMIT 6`,
      meal
    ),
    db.getAllAsync<Food>('SELECT * FROM foods WHERE favorite = 1 ORDER BY name LIMIT 20'),
    db.getAllAsync<Food>('SELECT * FROM foods WHERE last_used_at IS NOT NULL ORDER BY last_used_at DESC LIMIT 15'),
  ]);
  return { usual, favorites, recent };
}

export function listEntries(db: SQLiteDatabase, day: string) {
  return db.getAllAsync<FoodEntry>('SELECT * FROM food_entries WHERE day = ? ORDER BY created_at', day);
}

export function getEntry(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<FoodEntry>('SELECT * FROM food_entries WHERE id = ?', id);
}

/** Logs `grams` of a saved food and remembers the amount for next time. */
export async function logFood(db: SQLiteDatabase, food: Food, grams: number, day: string, meal: Meal) {
  const n = scale(food, grams);
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO food_entries (day, meal, food_id, name, grams, kcal, protein, carbs, fat, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      day,
      meal,
      food.id,
      food.name,
      grams,
      n.kcal,
      n.protein,
      n.carbs,
      n.fat,
      now
    );
    await db.runAsync('UPDATE foods SET last_grams = ?, last_used_at = ? WHERE id = ?', grams, now, food.id);
  });
}

/** Logs calories and macros directly, without a saved food. */
export async function logQuick(db: SQLiteDatabase, name: string, n: Nutrients, day: string, meal: Meal) {
  await db.runAsync(
    `INSERT INTO food_entries (day, meal, name, kcal, protein, carbs, fat, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    day,
    meal,
    name,
    n.kcal,
    n.protein,
    n.carbs,
    n.fat,
    Date.now()
  );
}

export async function updateEntry(db: SQLiteDatabase, entry: FoodEntry, food: Food, grams: number, meal: Meal) {
  const n = scale(food, grams);
  await db.runAsync(
    'UPDATE food_entries SET grams = ?, meal = ?, kcal = ?, protein = ?, carbs = ?, fat = ? WHERE id = ?',
    grams,
    meal,
    n.kcal,
    n.protein,
    n.carbs,
    n.fat,
    entry.id
  );
  await db.runAsync('UPDATE foods SET last_grams = ? WHERE id = ?', grams, food.id);
}

export async function deleteEntry(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM food_entries WHERE id = ?', id);
}

/** Copies one meal's entries from another day, e.g. yesterday's breakfast. */
export async function copyMeal(db: SQLiteDatabase, fromDay: string, toDay: string, meal: Meal) {
  await db.runAsync(
    `INSERT INTO food_entries (day, meal, food_id, name, grams, kcal, protein, carbs, fat, created_at)
     SELECT ?, meal, food_id, name, grams, kcal, protein, carbs, fat, ? FROM food_entries
     WHERE day = ? AND meal = ? ORDER BY created_at`,
    toDay,
    Date.now(),
    fromDay,
    meal
  );
}

export async function getWater(db: SQLiteDatabase, day: string) {
  const row = await db.getFirstAsync<{ ml: number }>('SELECT ml FROM water WHERE day = ?', day);
  return row?.ml ?? 0;
}

/** Adds (or with a negative amount, removes) water for a day, never going below zero. */
export async function addWater(db: SQLiteDatabase, day: string, ml: number) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT OR IGNORE INTO water (day, ml) VALUES (?, 0)', day);
    await db.runAsync('UPDATE water SET ml = MAX(0, ml + ?) WHERE day = ?', ml, day);
  });
}

/** Daily calorie and protein totals for the last `days` days with any food logged. */
export function dailyTotals(db: SQLiteDatabase, sinceDay: string) {
  return db.getAllAsync<{ day: string; kcal: number; protein: number }>(
    `SELECT day, SUM(kcal) AS kcal, SUM(protein) AS protein FROM food_entries
     WHERE day >= ? GROUP BY day ORDER BY day`,
    sinceDay
  );
}
