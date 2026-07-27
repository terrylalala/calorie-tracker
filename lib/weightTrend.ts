import { WeightEntry } from "./types";
import { GoalDirection } from "./goalsCalc";

/**
 * Weight trend + goal check. Pure functions, no I/O, so the "are you on track?"
 * judgement can be unit-reasoned and reused by the UI without a chart in the way.
 */

export interface Trend {
  /** Most recent reading, kg. */
  latestKg: number;
  /** Days between the first and last reading. */
  spanDays: number;
  /** Latest minus earliest, kg (negative = lost weight). */
  changeKg: number;
  /** Change normalised to kg per week over the span. */
  perWeekKg: number;
  /** Readings sorted oldest-first, for drawing. */
  points: WeightEntry[];
}

/** Build a trend from any-order readings. Returns null if there are none. */
export function computeTrend(weights: WeightEntry[]): Trend | null {
  if (weights.length === 0) return null;
  const points = [...weights].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  );
  const first = points[0];
  const last = points[points.length - 1];
  const spanMs = Date.parse(last.timestamp) - Date.parse(first.timestamp);
  const spanDays = spanMs / 86_400_000;
  const changeKg = last.kg - first.kg;
  // Guard the divide: a single day (or all readings on one day) has no rate.
  const perWeekKg = spanDays >= 1 ? changeKg / (spanDays / 7) : 0;
  return { latestKg: last.kg, spanDays, changeKg, perWeekKg, points };
}

export interface GoalCheck {
  /** "ok" = on track, "warn" = drifting from the goal, "info" = not enough data. */
  tone: "ok" | "warn" | "info";
  text: string;
}

// Below this weekly rate a change is treated as "flat" — within the noise of
// scale variation and hydration, not a real trend either way.
const FLAT_PER_WEEK = 0.05;
// How far a "maintain" goal may drift per week before it reads as off-target.
const MAINTAIN_BAND = 0.15;

function kgWeek(n: number): string {
  return `${Math.abs(n).toFixed(1)} kg/week`;
}

/**
 * Judge the trend against the stated goal. Deliberately gentle: it nudges, it
 * does not scold, and it needs a real span of data before saying anything.
 */
export function goalCheck(
  direction: GoalDirection | undefined,
  trend: Trend | null,
): GoalCheck {
  if (!trend || trend.points.length < 2 || trend.spanDays < 7) {
    return {
      tone: "info",
      text: "Keep logging your weight — a couple of weeks of readings will show whether your plan is working.",
    };
  }

  const w = trend.perWeekKg;

  if (direction === "lose") {
    return w <= -FLAT_PER_WEEK
      ? { tone: "ok", text: `Trending down about ${kgWeek(w)} — on track for your goal.` }
      : {
          tone: "warn",
          text: `Your weight hasn't been dropping over the last ${Math.round(trend.spanDays)} days. If losing is the goal, a slightly lower calorie target or a bit more movement would help.`,
        };
  }

  if (direction === "gain") {
    return w >= FLAT_PER_WEEK
      ? { tone: "ok", text: `Trending up about ${kgWeek(w)} — on track for your goal.` }
      : {
          tone: "warn",
          text: `Your weight hasn't been climbing over the last ${Math.round(trend.spanDays)} days. If gaining is the goal, try eating a little more.`,
        };
  }

  // maintain (the default when no direction is set)
  return Math.abs(w) <= MAINTAIN_BAND
    ? { tone: "ok", text: "Holding steady — on track to maintain." }
    : {
        tone: "warn",
        text: `You're drifting ${w > 0 ? "up" : "down"} about ${kgWeek(w)}. Nudge your intake to hold steady.`,
      };
}
