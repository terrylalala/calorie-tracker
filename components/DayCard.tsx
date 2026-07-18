"use client";

import { DailyTotals, FoodEntry, Goals } from "@/lib/types";
import { friendlyDate, progress } from "@/lib/nutrition";
import EntryCard from "./EntryCard";

/**
 * One day's summary in the History tab. Tapping it expands to reveal that
 * day's meals, each of which opens the meal detail sheet.
 */
export default function DayCard({
  day,
  goals,
  entries,
  expanded,
  onToggle,
  onOpen,
  onDelete,
}: {
  day: DailyTotals;
  goals: Goals;
  entries: FoodEntry[];
  expanded: boolean;
  onToggle: () => void;
  onOpen: (entry: FoodEntry) => void;
  onDelete: (id: string) => void;
}) {
  const p = progress(day.calories, goals.calories);
  const pct = Math.round(p.ratio * 100);

  return (
    <div className={`daycard${expanded ? " expanded" : ""}`}>
      <button
        className="daycard-head"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`${friendlyDate(day.date)}, ${day.calories} calories. ${expanded ? "Hide" : "Show"} meals`}
      >
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
          <span className="dtoggle">
            {day.count} item{day.count === 1 ? "" : "s"}
            <span className="chev">{expanded ? "▴" : "▾"}</span>
          </span>
        </div>
      </button>

      {expanded && (
        <div className="daycard-body">
          {entries.length === 0 ? (
            <div className="empty" style={{ padding: "18px 0" }}>
              No meals recorded for this day.
            </div>
          ) : (
            entries.map((e) => (
              <EntryCard key={e.id} entry={e} onDelete={onDelete} onOpen={onOpen} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
