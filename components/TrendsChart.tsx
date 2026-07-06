"use client";

import { DailyTotals } from "@/lib/types";

/** Inline-SVG bar chart of daily calories with a dashed goal line. */
export default function TrendsChart({
  series,
  goalCalories,
}: {
  series: DailyTotals[];
  goalCalories: number;
}) {
  const width = 520;
  const height = 200;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 24;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxVal = Math.max(goalCalories, ...series.map((d) => d.calories), 1) * 1.15;
  const n = series.length;
  const slot = plotW / n;
  const barW = Math.max(3, slot * 0.6);

  const goalY = padT + plotH - (goalCalories / maxVal) * plotH;

  // Only label a handful of x ticks to avoid clutter.
  const tickEvery = Math.ceil(n / 6);

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label="Daily calories chart"
      >
        {/* goal line */}
        <line
          x1={padL}
          x2={width - padR}
          y1={goalY}
          y2={goalY}
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          opacity="0.7"
        />
        <text x={padL} y={goalY - 4} fill="var(--accent)" fontSize="10">
          goal {goalCalories}
        </text>

        {series.map((d, i) => {
          const x = padL + i * slot + (slot - barW) / 2;
          const h = (d.calories / maxVal) * plotH;
          const y = padT + plotH - h;
          const over = d.calories > goalCalories;
          const label = d.date.slice(5); // MM-DD
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(0, h)}
                rx="2"
                fill={d.count === 0 ? "var(--surface-2)" : over ? "var(--fat)" : "var(--accent)"}
              />
              {i % tickEvery === 0 && (
                <text
                  x={x + barW / 2}
                  y={height - 8}
                  fill="var(--text-dim)"
                  fontSize="9"
                  textAnchor="middle"
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
