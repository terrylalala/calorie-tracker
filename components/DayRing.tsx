"use client";

import { DailyTotals, Goals } from "@/lib/types";
import { progress } from "@/lib/nutrition";

/** Calorie progress ring + protein/carbs/fat bars for a day. */
export default function DayRing({
  totals,
  goals,
}: {
  totals: DailyTotals;
  goals: Goals;
}) {
  const size = 108;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const cal = progress(totals.calories, goals.calories);
  const dash = circ * cal.clamped;
  const remaining = Math.max(0, goals.calories - totals.calories);
  const over = totals.calories > goals.calories;

  const bars: { name: string; value: number; target: number; color: string }[] = [
    { name: "Protein", value: totals.protein_g, target: goals.protein_g, color: "var(--protein)" },
    { name: "Carbs", value: totals.carbs_g, target: goals.carbs_g, color: "var(--carbs)" },
    { name: "Fat", value: totals.fat_g, target: goals.fat_g, color: "var(--fat)" },
  ];

  return (
    <div className="rings-row">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? "var(--fat)" : "var(--accent)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 0.4s ease" }}
        />
        <text
          x="50%"
          y="46%"
          textAnchor="middle"
          fill="var(--text)"
          fontSize="22"
          fontWeight="800"
        >
          {totals.calories}
        </text>
        <text
          x="50%"
          y="62%"
          textAnchor="middle"
          fill="var(--text-dim)"
          fontSize="10"
        >
          {over ? `+${totals.calories - goals.calories} over` : `${remaining} left`}
        </text>
      </svg>

      <div className="macro-bars">
        {bars.map((b) => {
          const p = progress(b.value, b.target);
          return (
            <div key={b.name}>
              <div className="macro-bar-label">
                <span className="name">{b.name}</span>
                <span>
                  {b.value} / {b.target} g
                </span>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${p.clamped * 100}%`, background: b.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
