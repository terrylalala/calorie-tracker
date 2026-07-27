"use client";

import { useEffect, useState } from "react";
import { Goals, WeightEntry } from "@/lib/types";
import { loadProfile } from "@/lib/storage";
import { StorageMode, putSettings } from "@/lib/dataStore";
import {
  GOAL_OPTIONS,
  GoalDirection,
  isProfileComplete,
  suggestGoals,
} from "@/lib/goalsCalc";
import AccountCard from "@/components/AccountCard";
import GoalAdvisor from "@/components/GoalAdvisor";
import WeightCard from "@/components/WeightCard";

/**
 * Extracted from app/page.tsx unchanged — see the note in HistoryView for why
 * this is shared rather than copied into /v2.
 */
export default function SettingsView({
  goals,
  onSave,
  mode,
  weights,
  onLogWeight,
  onRemoveWeight,
}: {
  goals: Goals;
  onSave: (g: Goals) => void;
  mode: StorageMode;
  weights: WeightEntry[];
  onLogWeight: (kg: number) => void;
  onRemoveWeight: (id: string) => void;
}) {
  const [calories, setCalories] = useState(String(goals.calories));
  const [protein, setProtein] = useState(String(goals.protein_g));
  const [carbs, setCarbs] = useState(String(goals.carbs_g));
  const [fat, setFat] = useState(String(goals.fat_g));
  const [saved, setSaved] = useState(false);

  const [showAdvisor, setShowAdvisor] = useState(false);
  const [direction, setDirection] = useState<GoalDirection>("maintain");
  const [profileWeight, setProfileWeight] = useState<number | undefined>();

  useEffect(() => {
    const p = loadProfile();
    if (p.goal) setDirection(p.goal);
    if (typeof p.weightKg === "number") setProfileWeight(p.weightKg);
  }, []);

  const num = (s: string) => {
    const n = parseFloat(s);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  };

  function handleSave() {
    onSave({
      calories: num(calories),
      protein_g: num(protein),
      carbs_g: num(carbs),
      fat_g: num(fat),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function applyGoals(g: Goals) {
    setCalories(String(g.calories));
    setProtein(String(g.protein_g));
    setCarbs(String(g.carbs_g));
    setFat(String(g.fat_g));
    onSave(g);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  /** Changing direction re-derives targets when we already know the profile. */
  function pickDirection(d: GoalDirection) {
    setDirection(d);
    const p = { ...loadProfile(), goal: d };
    void putSettings(mode, { profile: p });
    if (isProfileComplete(p)) {
      const s = suggestGoals(p);
      applyGoals({
        calories: s.calories,
        protein_g: s.protein_g,
        carbs_g: s.carbs_g,
        fat_g: s.fat_g,
      });
    }
  }

  const rows: [string, string, string, (v: string) => void][] = [
    ["Calories", calories, "kcal", setCalories],
    ["Protein", protein, "g", setProtein],
    ["Carbs", carbs, "g", setCarbs],
    ["Fat", fat, "g", setFat],
  ];

  return (
    <>
      <p className="eyebrow">Targets</p>
      <h1 className="page-title">Settings</h1>

      <div className="card">
        <p className="card-title">Daily targets</p>
        {rows.map(([name, value, unit, setter]) => (
          <div className="target-row" key={name}>
            <span className="tname">{name}</span>
            <span className="tinput">
              <input
                type="number"
                inputMode="numeric"
                value={value}
                onChange={(e) => setter(e.target.value)}
                aria-label={name}
              />
              <span className="unit">{unit}</span>
            </span>
          </div>
        ))}
        <button
          className="btn block"
          style={{ marginTop: 14 }}
          onClick={() => setShowAdvisor(true)}
        >
          ✨ Suggest goals for me
        </button>
      </div>

      <div className="card">
        <p className="card-title">Goal</p>
        <div className="goalseg">
          {GOAL_OPTIONS.map((g) => (
            <button
              key={g.value}
              className={direction === g.value ? "active" : ""}
              onClick={() => pickDirection(g.value)}
            >
              <span className="gt">{GOAL_LABELS[g.value]}</span>
              <span className="gs">{GOAL_SUBS[g.value]}</span>
            </button>
          ))}
        </div>
      </div>

      <button className="btn primary block" onClick={handleSave}>
        {saved ? "✓ Saved" : "Save changes"}
      </button>

      <WeightCard
        weights={weights}
        direction={direction}
        defaultKg={profileWeight}
        onLog={onLogWeight}
        onRemoveLast={() => {
          const latest = weights.length
            ? [...weights].sort(
                (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
              )[0]
            : null;
          if (latest) onRemoveWeight(latest.id);
        }}
      />

      <AccountCard />

      <div className="card">
        <p className="card-title">Storage</p>
        <p className="assumptions" style={{ marginBottom: 0, marginTop: -6 }}>
          {mode === "db"
            ? "Your log is saved to your account and syncs across your devices."
            : "Your log is saved on this device only."}
        </p>
      </div>

      <p className="disclaimer">
        AI estimates are approximate. Not medical advice.
      </p>

      {showAdvisor && (
        <GoalAdvisor onApply={applyGoals} onClose={() => setShowAdvisor(false)} />
      )}
    </>
  );
}

const GOAL_LABELS: Record<GoalDirection, string> = {
  lose: "Cut",
  maintain: "Maintain",
  gain: "Bulk",
};
const GOAL_SUBS: Record<GoalDirection, string> = {
  lose: "Steady deficit",
  maintain: "Hold steady",
  gain: "Gentle surplus",
};
