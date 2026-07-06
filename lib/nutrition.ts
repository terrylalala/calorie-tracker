import { DailyTotals, FoodEntry, Goals, Macros } from "./types";

/** Local calendar date key (YYYY-MM-DD) for a Date, in the user's timezone. */
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Human-friendly label for a date key, e.g. "Today", "Yesterday", or "Mon, Jul 7". */
export function friendlyDate(key: string): string {
  const today = dateKey();
  const yesterday = dateKey(new Date(Date.now() - 86400000));
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function roundMacros(m: Macros): Macros {
  return {
    calories: Math.round(m.calories),
    protein_g: Math.round(m.protein_g),
    carbs_g: Math.round(m.carbs_g),
    fat_g: Math.round(m.fat_g),
  };
}

/** Sum a list of entries into total macros. */
export function sumMacros(entries: Macros[]): Macros {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + (e.calories || 0),
      protein_g: acc.protein_g + (e.protein_g || 0),
      carbs_g: acc.carbs_g + (e.carbs_g || 0),
      fat_g: acc.fat_g + (e.fat_g || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

/** Totals for a single day key. */
export function totalsForDate(entries: FoodEntry[], key: string): DailyTotals {
  const forDay = entries.filter((e) => e.date === key);
  const sum = roundMacros(sumMacros(forDay));
  return { date: key, count: forDay.length, ...sum };
}

/**
 * Daily totals for the last `days` calendar days, oldest → newest.
 * Days with no entries are included with zeroed totals so charts stay continuous.
 */
export function dailySeries(entries: FoodEntry[], days: number): DailyTotals[] {
  const out: DailyTotals[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = dateKey(new Date(Date.now() - i * 86400000));
    out.push(totalsForDate(entries, key));
  }
  return out;
}

/** Average macros across days that actually have entries (avoids zero-day dilution). */
export function averageOfLoggedDays(series: DailyTotals[]): Macros {
  const logged = series.filter((d) => d.count > 0);
  if (logged.length === 0) return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const sum = sumMacros(logged);
  return roundMacros({
    calories: sum.calories / logged.length,
    protein_g: sum.protein_g / logged.length,
    carbs_g: sum.carbs_g / logged.length,
    fat_g: sum.fat_g / logged.length,
  });
}

/** Progress 0..1 (clamped for ring rendering) plus the raw ratio for labels. */
export function progress(value: number, target: number): { clamped: number; ratio: number } {
  if (!target || target <= 0) return { clamped: 0, ratio: 0 };
  const ratio = value / target;
  return { clamped: Math.max(0, Math.min(1, ratio)), ratio };
}

/**
 * Build a compact, model-friendly summary of recent logging for the advice route.
 * Kept small (numbers only, no raw photos) to stay cheap and fast.
 */
export function buildLogsSummary(
  entries: FoodEntry[],
  goals: Goals,
  days = 14,
): string {
  const series = dailySeries(entries, days);
  const lines = series.map((d) => {
    if (d.count === 0) return `${d.date}: (no entries)`;
    return `${d.date}: ${d.calories} kcal, P ${d.protein_g}g, C ${d.carbs_g}g, F ${d.fat_g}g (${d.count} item${d.count === 1 ? "" : "s"})`;
  });
  const avg = averageOfLoggedDays(series);
  const loggedDays = series.filter((d) => d.count > 0).length;

  return [
    `Daily goals: ${goals.calories} kcal, protein ${goals.protein_g}g, carbs ${goals.carbs_g}g, fat ${goals.fat_g}g.`,
    `Days logged in the last ${days}: ${loggedDays}.`,
    `Average on logged days: ${avg.calories} kcal, P ${avg.protein_g}g, C ${avg.carbs_g}g, F ${avg.fat_g}g.`,
    ``,
    `Per-day breakdown (oldest to newest):`,
    ...lines,
  ].join("\n");
}
