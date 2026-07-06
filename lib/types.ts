// Shared types for the calorie tracker.

/** Macro numbers, all in grams except calories (kcal). */
export interface Macros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** One detected food item within a photo analysis. */
export interface AnalyzedItem extends Macros {
  name: string;
  portion: string;
}

/** Raw result returned by /api/analyze (Claude vision, structured output). */
export interface Analysis extends Macros {
  title: string;
  items: AnalyzedItem[];
  /** 0..1 model self-reported confidence. */
  confidence: number;
  /** Short note on assumptions made (portion size, hidden ingredients, etc.). */
  assumptions: string;
}

/** A saved log entry. Macros are the (possibly user-edited) final numbers. */
export interface FoodEntry extends Macros {
  id: string;
  /** ISO timestamp of when the food was logged. */
  timestamp: string;
  /** Local calendar date key, YYYY-MM-DD, used for grouping by day. */
  date: string;
  name: string;
  portion: string;
  /** How this entry was created. */
  source: "photo" | "manual";
  /** Optional free-text note (e.g. Claude's assumptions). */
  note?: string;
}

/** Daily nutrition targets. */
export interface Goals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** Aggregated totals for a single day. */
export interface DailyTotals extends Macros {
  date: string;
  count: number;
}

export const DEFAULT_GOALS: Goals = {
  calories: 2000,
  protein_g: 140,
  carbs_g: 200,
  fat_g: 65,
};

export const EMPTY_MACROS: Macros = {
  calories: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
};
