"use client";

import { useMemo, useState } from "react";
import { FoodEntry, Goals } from "@/lib/types";
import { averageOfLoggedDays, dailySeries } from "@/lib/nutrition";
import TrendsChart from "@/components/TrendsChart";
import DayCard from "@/components/DayCard";

/**
 * Extracted from app/page.tsx unchanged, so the shipped design and the /v2
 * design can share ONE implementation instead of keeping two in sync. This
 * project has repeatedly been bitten by a fix living in one copy and never
 * reaching its twin; a second copy of this view would have been the next one.
 *
 * Styling is by class name, and /v2 re-skins those same classes rather than
 * forking the markup.
 */
export default function HistoryView({
  entries,
  goals,
  onOpen,
  onDelete,
  onAddPastMeal,
}: {
  entries: FoodEntry[];
  goals: Goals;
  onOpen: (e: FoodEntry) => void;
  onDelete: (id: string) => void;
  /** Open the backfill flow for a missed day. Optional so the view still works
   *  anywhere it might be rendered without the launcher wired in. */
  onAddPastMeal?: () => void;
}) {
  const [range, setRange] = useState<7 | 30>(7);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const series = useMemo(() => dailySeries(entries, range), [entries, range]);
  const avg = useMemo(() => averageOfLoggedDays(series), [series]);
  const logged = series.filter((d) => d.count > 0);

  return (
    <>
      <p className="eyebrow">Patterns</p>
      <h1 className="page-title">History</h1>
      <p className="page-sub">
        {logged.length} day{logged.length === 1 ? "" : "s"} logged in the last {range}.
      </p>

      {onAddPastMeal && (
        <button className="add-past-btn" onClick={onAddPastMeal}>
          <span aria-hidden="true">＋</span> Add a past meal
        </button>
      )}

      <div className="card">
        <div className="range-toggle">
          <button className={range === 7 ? "active" : ""} onClick={() => setRange(7)}>
            7 days
          </button>
          <button className={range === 30 ? "active" : ""} onClick={() => setRange(30)}>
            30 days
          </button>
        </div>
        <TrendsChart series={series} goalCalories={goals.calories} />
      </div>

      {logged.length > 0 && (
        <div className="card">
          <p className="label-sm">Average on logged days</p>
          <div className="stat-strong">{avg.calories} kcal</div>
          <div className="stat-sub">
            Protein {avg.protein_g}g · Carbs {avg.carbs_g}g · Fat {avg.fat_g}g per day
          </div>
        </div>
      )}

      <div className="section-head">
        <h2>Daily breakdown</h2>
      </div>

      {logged.length === 0 ? (
        <div className="empty">No days logged in this range yet.</div>
      ) : (
        [...logged]
          .reverse()
          .map((d) => (
            <DayCard
              key={d.date}
              day={d}
              goals={goals}
              entries={entries.filter((e) => e.date === d.date)}
              expanded={openDay === d.date}
              onToggle={() => setOpenDay(openDay === d.date ? null : d.date)}
              onOpen={onOpen}
              onDelete={onDelete}
            />
          ))
      )}
    </>
  );
}
