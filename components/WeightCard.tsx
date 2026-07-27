"use client";

import { useState } from "react";
import { WeightEntry } from "@/lib/types";
import { GoalDirection } from "@/lib/goalsCalc";
import { friendlyDate } from "@/lib/nutrition";
import { computeTrend, goalCheck } from "@/lib/weightTrend";

/**
 * The weight section on Settings: log a reading, see the trend, and a plain
 * note on whether that trend matches the goal. Storage lives in BrightApp; this
 * is a controlled view over the readings and two callbacks.
 */
export default function WeightCard({
  weights,
  direction,
  defaultKg,
  onLog,
  onRemoveLast,
}: {
  weights: WeightEntry[];
  direction: GoalDirection;
  /** Pre-fills the input so a similar reading is one tap away. */
  defaultKg?: number;
  onLog: (kg: number) => void;
  onRemoveLast: () => void;
}) {
  const latest = weights.length
    ? [...weights].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0]
    : null;

  const [value, setValue] = useState(
    latest ? String(latest.kg) : defaultKg ? String(defaultKg) : "",
  );

  const kg = parseFloat(value);
  const canLog = Number.isFinite(kg) && kg >= 20 && kg <= 500;

  const trend = computeTrend(weights);
  const check = goalCheck(direction, trend);

  return (
    <div className="card">
      <p className="card-title">Weight</p>

      {latest ? (
        <div className="weight-head">
          <div>
            <div className="weight-now">
              {latest.kg}
              <span className="weight-unit"> kg</span>
            </div>
            <div className="weight-date">{friendlyDate(latest.date)}</div>
          </div>
          {trend && trend.points.length >= 2 && (
            <div
              className={`weight-delta ${trend.changeKg < 0 ? "down" : trend.changeKg > 0 ? "up" : ""}`}
            >
              {trend.changeKg > 0 ? "+" : ""}
              {trend.changeKg.toFixed(1)} kg
              <span className="weight-delta-sub">in {Math.max(1, Math.round(trend.spanDays))}d</span>
            </div>
          )}
        </div>
      ) : (
        <p className="assumptions" style={{ marginTop: -6 }}>
          Log your weight to start tracking, and see whether your plan is working.
        </p>
      )}

      {trend && trend.points.length >= 2 && <WeightChart points={trend.points} />}

      <div className={`weight-check ${check.tone}`}>{check.text}</div>

      <div className="weight-log">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Weight in kilograms"
          placeholder="e.g. 68.5"
        />
        <span className="weight-log-unit">kg</span>
        <button
          className="btn primary"
          disabled={!canLog}
          onClick={() => {
            onLog(Math.round(kg * 10) / 10);
          }}
        >
          Log
        </button>
      </div>

      {latest && (
        <button className="weight-remove" onClick={onRemoveLast}>
          Remove last reading
        </button>
      )}
    </div>
  );
}

/**
 * A compact line of the readings over time. x is placed by ACTUAL date so
 * irregular logging isn't flattened to even spacing; y spans the min–max with a
 * little padding. Falls back to even spacing when every reading is one day.
 */
function WeightChart({ points }: { points: WeightEntry[] }) {
  const W = 300;
  const H = 96;
  const padX = 6;
  const padY = 12;

  const ts = points.map((p) => Date.parse(p.timestamp));
  const t0 = ts[0];
  const tN = ts[ts.length - 1];
  const span = tN - t0;

  const kgs = points.map((p) => p.kg);
  const min = Math.min(...kgs);
  const max = Math.max(...kgs);
  const range = max - min || 1;

  const x = (i: number) =>
    span > 0
      ? padX + ((ts[i] - t0) / span) * (W - 2 * padX)
      : padX + (i / Math.max(1, points.length - 1)) * (W - 2 * padX);
  const y = (kg: number) => padY + (1 - (kg - min) / range) * (H - 2 * padY);

  const line = points.map((p, i) => `${x(i)},${y(p.kg)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <svg className="weight-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Weight over time">
      <polyline
        points={line}
        fill="none"
        stroke="var(--v2-tab-hue, #f79318)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle key={p.id} cx={x(i)} cy={y(p.kg)} r={i === points.length - 1 ? 4 : 2.5}
          fill="var(--v2-tab-hue, #f79318)" />
      ))}
      <text className="weight-chart-max" x={padX} y={padY - 2}>{max} kg</text>
      <text className="weight-chart-min" x={padX} y={H - 3}>{min} kg</text>
      <text className="weight-chart-latest" x={x(points.length - 1)} y={y(last.kg) - 8}
        textAnchor="end">{last.kg}</text>
    </svg>
  );
}
