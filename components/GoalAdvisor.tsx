"use client";

import { useMemo, useState } from "react";
import { Goals } from "@/lib/types";
import {
  ACTIVITY_OPTIONS,
  GOAL_OPTIONS,
  Profile,
  isProfileComplete,
  suggestGoals,
} from "@/lib/goalsCalc";
import { loadProfile, saveProfile } from "@/lib/storage";
import { apiHeaders } from "@/lib/api";
import { markdownToHtml } from "@/lib/markdown";

/** Bottom sheet: collect a profile, compute suggested targets, optionally explain. */
export default function GoalAdvisor({
  onApply,
  onClose,
}: {
  onApply: (goals: Goals) => void;
  onClose: () => void;
}) {
  const saved = loadProfile();
  const [age, setAge] = useState(saved.age ? String(saved.age) : "");
  const [sex, setSex] = useState<Profile["sex"]>(saved.sex ?? "male");
  const [heightCm, setHeightCm] = useState(saved.heightCm ? String(saved.heightCm) : "");
  const [weightKg, setWeightKg] = useState(saved.weightKg ? String(saved.weightKg) : "");
  const [activity, setActivity] = useState<Profile["activity"]>(saved.activity ?? "moderate");
  const [goal, setGoal] = useState<Profile["goal"]>(saved.goal ?? "maintain");

  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const num = (s: string) => {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  };

  const profile: Partial<Profile> = {
    age: num(age),
    sex,
    heightCm: num(heightCm),
    weightKg: num(weightKg),
    activity,
    goal,
  };

  const complete = isProfileComplete(profile);
  const suggestion = useMemo(
    () => (complete ? suggestGoals(profile as Profile) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [age, sex, heightCm, weightKg, activity, goal, complete],
  );

  const goalHint = GOAL_OPTIONS.find((g) => g.value === goal)?.hint ?? "";

  function persist() {
    if (complete) saveProfile(profile);
  }

  function handleApply() {
    if (!suggestion) return;
    persist();
    const goals: Goals = {
      calories: suggestion.calories,
      protein_g: suggestion.protein_g,
      carbs_g: suggestion.carbs_g,
      fat_g: suggestion.fat_g,
    };
    onApply(goals);
    onClose();
  }

  async function handleExplain() {
    if (!suggestion) return;
    persist();
    setExplaining(true);
    setError(null);
    setExplanation(null);
    const p = profile as Profile;
    const activityLabel = ACTIVITY_OPTIONS.find((a) => a.value === p.activity)?.label ?? p.activity;
    const goalLabel = GOAL_OPTIONS.find((g) => g.value === p.goal)?.label ?? p.goal;
    const summary =
      `Profile: ${p.age}yo ${p.sex}, ${p.heightCm} cm, ${p.weightKg} kg, activity: ${activityLabel}, goal: ${goalLabel}.\n` +
      `Calculated targets: ${suggestion.calories} kcal/day, protein ${suggestion.protein_g} g, carbs ${suggestion.carbs_g} g, fat ${suggestion.fat_g} g.\n` +
      `(BMR ~${suggestion.bmr} kcal, estimated daily burn ~${suggestion.tdee} kcal.)`;
    try {
      const res = await fetch("/api/goal-advice", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ summary }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Could not get an explanation.");
      else setExplanation(data.advice);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setExplaining(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-scroll">
          <h2>✨ Suggest goals for me</h2>
          <p className="assumptions">
            Answer a few questions and we&apos;ll estimate sensible daily targets. You
            can still edit them afterwards.
          </p>

          <div className="grid-4">
            <div className="field">
              <label>Age</label>
              <input
                type="number"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="years"
              />
            </div>
            <div className="field">
              <label>Sex</label>
              <div className="seg">
                <button
                  className={sex === "male" ? "active" : ""}
                  onClick={() => setSex("male")}
                >
                  Male
                </button>
                <button
                  className={sex === "female" ? "active" : ""}
                  onClick={() => setSex("female")}
                >
                  Female
                </button>
              </div>
            </div>
          </div>

          <div className="grid-4">
            <div className="field">
              <label>Height (cm)</label>
              <input
                type="number"
                inputMode="numeric"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="cm"
              />
            </div>
            <div className="field">
              <label>Weight (kg)</label>
              <input
                type="number"
                inputMode="numeric"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="kg"
              />
            </div>
          </div>

          <div className="field">
            <label>Activity level</label>
            <select value={activity} onChange={(e) => setActivity(e.target.value as Profile["activity"])}>
              {ACTIVITY_OPTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label} — {a.hint}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Goal</label>
            <div className="seg">
              {GOAL_OPTIONS.map((g) => (
                <button
                  key={g.value}
                  className={goal === g.value ? "active" : ""}
                  onClick={() => setGoal(g.value)}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <p className="assumptions" style={{ margin: "6px 0 0" }}>
              {goalHint}
            </p>
          </div>

          {suggestion ? (
            <div className="result-card">
              <p className="card-title" style={{ margin: 0 }}>Suggested daily targets</p>
              <div className="stat-strong">{suggestion.calories} kcal</div>
              <div className="stat-sub">
                Protein {suggestion.protein_g}g · Carbs {suggestion.carbs_g}g · Fat{" "}
                {suggestion.fat_g}g
              </div>
              <p className="assumptions" style={{ marginBottom: 0 }}>
                Based on a BMR of ~{suggestion.bmr} kcal and an estimated daily burn of
                ~{suggestion.tdee} kcal for your activity.
                {suggestion.floored &&
                  " Adjusted up to a safe minimum intake — consider a smaller deficit."}
              </p>
            </div>
          ) : (
            <p className="assumptions">Fill in every field to see your suggested targets.</p>
          )}

          {suggestion && (
            <button
              className="btn block"
              style={{ marginTop: 4 }}
              onClick={handleExplain}
              disabled={explaining}
            >
              {explaining ? "Thinking…" : "💡 Explain these targets"}
            </button>
          )}

          {error && <div className="error-note" style={{ marginTop: 12 }}>{error}</div>}
          {explanation && (
            <div
              className="advice-body"
              style={{ marginTop: 12 }}
              dangerouslySetInnerHTML={{ __html: markdownToHtml(explanation) }}
            />
          )}

          <p className="disclaimer" style={{ marginTop: 16 }}>
            Estimates only — general wellness guidance, not medical advice.
          </p>
        </div>

        <div className="sheet-footer">
          <div className="fab-row">
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" disabled={!suggestion} onClick={handleApply}>
              Apply these goals
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
