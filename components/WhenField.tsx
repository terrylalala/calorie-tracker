"use client";

import { WhenParts } from "@/lib/when";

/**
 * The date + time control shown in the logging sheets ONLY when backfilling a
 * past meal. On the normal "log now" path the sheets render no When field at
 * all and stamp the current time, so the everyday flow is unchanged.
 *
 * Presentational and controlled: the parent owns the two strings so both
 * ManualEntryForm and AnalyzeSheet share one implementation instead of keeping
 * two copies of the same inputs in sync.
 */
export default function WhenField({
  value,
  onChange,
}: {
  value: WhenParts;
  onChange: (next: WhenParts) => void;
}) {
  // Cap the date at today: you can log a meal you forgot, not one in the future.
  const today = new Date();
  const max = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;

  return (
    <div className="field">
      <label>When</label>
      <div className="when-row">
        <input
          type="date"
          value={value.date}
          max={max}
          onChange={(e) => onChange({ ...value, date: e.target.value })}
          aria-label="Date"
        />
        <input
          type="time"
          value={value.time}
          onChange={(e) => onChange({ ...value, time: e.target.value })}
          aria-label="Time"
        />
      </div>
    </div>
  );
}
