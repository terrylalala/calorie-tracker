"use client";

import { DailyTotals, Goals } from "@/lib/types";
import { friendlyDate, progress } from "@/lib/nutrition";

/** One day's summary card in the History tab. */
export default function DayCard({
  day,
  goals,
}: {
  day: DailyTotals;
  goals: Goals;
}) {
  const p = progress(day.calories, goals.calories);
  const pct = Math.round(p.ratio * 100);

  return (
    <div className="daycard">
      <div className="top">
        <div>
          <div className="dname">{friendlyDate(day.date)}</div>
          <div className="ddate">{day.date}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="dcal">
            {day.calories}
            <span className="dtarget"> / {goals.calories}</span>
          </div>
          <div className="dpct">{pct}%</div>
        </div>
      </div>

      <div className="bar">
        <span
          style={{
            width: `${p.clamped * 100}%`,
            background: p.ratio > 1 ? "var(--fat)" : "var(--accent)",
          }}
        />
      </div>

      <div className="dmacros">
        <span>
          P <b>{day.protein_g}g</b>
        </span>
        <span>
          C <b>{day.carbs_g}g</b>
        </span>
        <span>
          F <b>{day.fat_g}g</b>
        </span>
        <span>
          {day.count} item{day.count === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
