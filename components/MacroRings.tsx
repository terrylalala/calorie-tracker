"use client";

import { DailyTotals, Goals } from "@/lib/types";
import { progress } from "@/lib/nutrition";

interface RingSpec {
  key: string;
  name: string;
  unit: string;
  value: number;
  target: number;
  color: string;
}

function Ring({ spec }: { spec: RingSpec }) {
  const size = 68;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = progress(spec.value, spec.target);
  const dash = circ * p.clamped;

  return (
    <div className="ring">
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
          stroke={spec.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 0.4s ease" }}
        />
        <text
          x="50%"
          y="47%"
          textAnchor="middle"
          fill="var(--text)"
          fontSize="17"
          fontWeight="700"
          fontFamily="var(--serif)"
        >
          {Math.round(spec.value)}
        </text>
        <text
          x="50%"
          y="65%"
          textAnchor="middle"
          fill="var(--text-dim)"
          fontSize="9"
        >
          /{spec.target}
        </text>
      </svg>
      <div className="name">
        {spec.name}
        <br />
        {spec.unit}
      </div>
    </div>
  );
}

/** Four macro progress rings for a day (calories, protein, carbs, fat). */
export default function MacroRings({
  totals,
  goals,
}: {
  totals: DailyTotals;
  goals: Goals;
}) {
  const specs: RingSpec[] = [
    {
      key: "cal",
      name: "Calories",
      unit: "kcal",
      value: totals.calories,
      target: goals.calories,
      color: "var(--cal)",
    },
    {
      key: "pro",
      name: "Protein",
      unit: "g",
      value: totals.protein_g,
      target: goals.protein_g,
      color: "var(--protein)",
    },
    {
      key: "carb",
      name: "Carbs",
      unit: "g",
      value: totals.carbs_g,
      target: goals.carbs_g,
      color: "var(--carbs)",
    },
    {
      key: "fat",
      name: "Fat",
      unit: "g",
      value: totals.fat_g,
      target: goals.fat_g,
      color: "var(--fat)",
    },
  ];

  return (
    <div className="rings">
      {specs.map((s) => (
        <Ring key={s.key} spec={s} />
      ))}
    </div>
  );
}
