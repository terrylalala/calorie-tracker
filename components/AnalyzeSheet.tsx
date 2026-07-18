"use client";

import { useState } from "react";
import { Analysis, FoodEntry } from "@/lib/types";
import { dateKey } from "@/lib/nutrition";

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Quick portion-size presets shown as chips in the review sheet. */
const PORTION_MULTIPLIERS = [0.25, 0.5, 1, 1.5, 2];

/**
 * Editable review sheet shown after a photo is analyzed. The user can tweak any
 * field (estimates are approximate) before saving to the log.
 */
export default function AnalyzeSheet({
  analysis,
  previewUrl,
  onSave,
  onClose,
}: {
  analysis: Analysis;
  previewUrl?: string;
  onSave: (entry: FoodEntry) => void;
  onClose: () => void;
}) {
  const items = analysis.items ?? [];
  const basePortion =
    items.map((i) => i.portion).filter(Boolean).join(", ") || "1 serving";

  const [name, setName] = useState(analysis.title || items[0]?.name || "Meal");
  const [portion, setPortion] = useState(basePortion);
  const [calories, setCalories] = useState(String(Math.round(analysis.calories)));
  const [protein, setProtein] = useState(String(Math.round(analysis.protein_g)));
  const [carbs, setCarbs] = useState(String(Math.round(analysis.carbs_g)));
  const [fat, setFat] = useState(String(Math.round(analysis.fat_g)));

  // Portion multiplier: scales every macro off the ORIGINAL estimate, so tapping
  // 0.5× then 2× returns to the original numbers (no compounding drift).
  const [multiplier, setMultiplier] = useState<number | null>(1);
  const [portionEdited, setPortionEdited] = useState(false);

  function applyMultiplier(m: number) {
    setMultiplier(m);
    setCalories(String(Math.round(analysis.calories * m)));
    setProtein(String(Math.round(analysis.protein_g * m)));
    setCarbs(String(Math.round(analysis.carbs_g * m)));
    setFat(String(Math.round(analysis.fat_g * m)));
    // Keep the portion label in sync unless the user has typed their own.
    if (!portionEdited) {
      setPortion(m === 1 ? basePortion : `${m}× ${basePortion}`);
    }
  }

  /** Manual macro edits clear the active multiplier chip. */
  function editMacro(setter: (v: string) => void) {
    return (v: string) => {
      setter(v);
      setMultiplier(null);
    };
  }

  const num = (s: string) => {
    const n = parseFloat(s);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  function handleSave() {
    const now = new Date();
    const entry: FoodEntry = {
      id: newId(),
      timestamp: now.toISOString(),
      date: dateKey(now),
      name: name.trim() || "Meal",
      portion: portion.trim(),
      calories: num(calories),
      protein_g: num(protein),
      carbs_g: num(carbs),
      fat_g: num(fat),
      source: "photo",
      note: analysis.assumptions || undefined,
    };
    onSave(entry);
  }

  const lowConfidence = analysis.confidence > 0 && analysis.confidence < 0.4;
  const noFood = analysis.calories === 0 && items.length === 0;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Review &amp; log</h2>
          <button className="close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="sheet-scroll">
        {previewUrl && <img className="thumb" src={previewUrl} alt="Food" />}

        <div className="field">
          <label>Food</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="field">
          <label>Portion</label>
          <div className="chips">
            {PORTION_MULTIPLIERS.map((m) => (
              <button
                key={m}
                className={multiplier === m ? "active" : ""}
                onClick={() => applyMultiplier(m)}
              >
                {m}×
              </button>
            ))}
          </div>
        </div>

        <div className="macro-boxes">
          <div className="mbox cal">
            <input
              type="number"
              inputMode="numeric"
              value={calories}
              onChange={(e) => editMacro(setCalories)(e.target.value)}
              aria-label="Calories"
            />
            <div className="u">kcal</div>
          </div>
          <div className="mbox pro">
            <input
              type="number"
              inputMode="numeric"
              value={protein}
              onChange={(e) => editMacro(setProtein)(e.target.value)}
              aria-label="Protein grams"
            />
            <div className="u">P</div>
          </div>
          <div className="mbox carb">
            <input
              type="number"
              inputMode="numeric"
              value={carbs}
              onChange={(e) => editMacro(setCarbs)(e.target.value)}
              aria-label="Carbs grams"
            />
            <div className="u">C</div>
          </div>
          <div className="mbox fat">
            <input
              type="number"
              inputMode="numeric"
              value={fat}
              onChange={(e) => editMacro(setFat)(e.target.value)}
              aria-label="Fat grams"
            />
            <div className="u">F</div>
          </div>
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label>Portion detail</label>
          <input
            value={portion}
            onChange={(e) => {
              setPortion(e.target.value);
              setPortionEdited(true);
            }}
          />
        </div>

        <p className="note-italic">
          {noFood
            ? "No food was clearly detected — you can still enter the details manually above."
            : analysis.assumptions}
          {lowConfidence && " (Low confidence — please double-check the numbers.)"}
        </p>

        </div>
        <div className="sheet-footer">
          <div className="fab-row">
            <button className="btn" onClick={onClose}>
              Discard
            </button>
            <button className="btn primary" onClick={handleSave}>
              Log it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
