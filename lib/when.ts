import { dateKey } from "./nutrition";

/**
 * Helpers for the "When" control used when backfilling a past meal.
 *
 * A meal's day (Breakfast/Lunch/Snack/Dinner) is derived from its timestamp
 * hour, and History groups by the local date key — so a backfilled entry only
 * needs a correct local Date. These convert between a Date and the two <input>
 * values (a `YYYY-MM-DD` date and an `HH:MM` time), staying in LOCAL time
 * throughout: `new Date("2026-07-22T12:00")` with no zone is parsed as local,
 * which is exactly what dateKey() and sittingFor() expect.
 */

export interface WhenParts {
  /** YYYY-MM-DD, for a <input type="date">. */
  date: string;
  /** HH:MM, for a <input type="time">. */
  time: string;
}

/** Split a Date into the local date + time strings the two inputs use. */
export function localParts(d: Date): WhenParts {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return { date: dateKey(d), time: `${hh}:${mm}` };
}

/**
 * Rebuild a local Date from the two input strings. Falls back to noon if the
 * time is blank, so a backfilled meal with only a date lands in "Lunch" rather
 * than at midnight (which would read as the previous evening in some cases).
 */
export function partsToDate({ date, time }: WhenParts): Date {
  const t = time && /^\d{2}:\d{2}$/.test(time) ? time : "12:00";
  const d = new Date(`${date}T${t}`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** The default "When" for a new backfill: yesterday at noon, in local time. */
export function defaultBackfillWhen(): Date {
  const d = new Date(Date.now() - 86_400_000);
  d.setHours(12, 0, 0, 0);
  return d;
}
