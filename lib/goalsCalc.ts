import { Goals } from "./types";

// Profile the Goal Advisor collects to estimate targets.
export interface Profile {
  age: number;
  sex: "male" | "female";
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: GoalDirection;
}

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very";
export type GoalDirection = "lose" | "maintain" | "gain";

export interface Suggestion extends Goals {
  bmr: number;
  tdee: number;
  floored: boolean; // true if calories were clamped to a safe minimum
}

export const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; hint: string; factor: number }[] = [
  { value: "sedentary", label: "Sedentary", hint: "Little or no exercise", factor: 1.2 },
  { value: "light", label: "Light", hint: "Exercise 1–3 days/week", factor: 1.375 },
  { value: "moderate", label: "Moderate", hint: "Exercise 3–5 days/week", factor: 1.55 },
  { value: "active", label: "Active", hint: "Exercise 6–7 days/week", factor: 1.725 },
  { value: "very", label: "Very active", hint: "Hard exercise / physical job", factor: 1.9 },
];

export const GOAL_OPTIONS: { value: GoalDirection; label: string; hint: string }[] = [
  { value: "lose", label: "Lose weight", hint: "~0.5 kg / week deficit" },
  { value: "maintain", label: "Maintain", hint: "Stay at current weight" },
  { value: "gain", label: "Gain muscle", hint: "Lean surplus" },
];

function activityFactor(level: ActivityLevel): number {
  return ACTIVITY_OPTIONS.find((o) => o.value === level)?.factor ?? 1.2;
}

/** Basal Metabolic Rate — Mifflin-St Jeor equation. */
export function bmr(p: Profile): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === "male" ? base + 5 : base - 161;
}

/**
 * Compute suggested daily calorie + macro targets from a profile.
 *
 * - Calories: TDEE (BMR × activity) adjusted for the goal, clamped to a safe floor.
 * - Protein: 2.0 g/kg when losing (muscle retention), else 1.8 g/kg.
 * - Fat: 25% of calories.
 * - Carbs: whatever calories remain.
 */
export function suggestGoals(p: Profile): Suggestion {
  const base = bmr(p);
  const tdee = base * activityFactor(p.activity);

  let calories = tdee;
  if (p.goal === "lose") calories -= 500;
  else if (p.goal === "gain") calories += 350;

  // Safe minimum intake to avoid recommending an unhealthily low target.
  const floor = p.sex === "male" ? 1500 : 1200;
  const floored = calories < floor;
  if (floored) calories = floor;

  const proteinPerKg = p.goal === "lose" ? 2.0 : 1.8;
  const proteinG = proteinPerKg * p.weightKg;
  const fatG = (calories * 0.25) / 9;
  const carbsG = Math.max(0, (calories - proteinG * 4 - fatG * 9) / 4);

  return {
    calories: Math.round(calories / 10) * 10,
    protein_g: Math.round(proteinG),
    carbs_g: Math.round(carbsG),
    fat_g: Math.round(fatG),
    bmr: Math.round(base),
    tdee: Math.round(tdee),
    floored,
  };
}

/** Whether all profile fields are present and in sane ranges. */
export function isProfileComplete(p: Partial<Profile>): p is Profile {
  return (
    typeof p.age === "number" && p.age >= 13 && p.age <= 100 &&
    (p.sex === "male" || p.sex === "female") &&
    typeof p.heightCm === "number" && p.heightCm >= 120 && p.heightCm <= 230 &&
    typeof p.weightKg === "number" && p.weightKg >= 30 && p.weightKg <= 300 &&
    !!p.activity &&
    !!p.goal
  );
}
