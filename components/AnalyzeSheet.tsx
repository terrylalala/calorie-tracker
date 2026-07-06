"use client";

import { useState } from "react";
import { Analysis, FoodEntry } from "@/lib/types";
import { dateKey } from "@/lib/nutrition";

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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
  const [name, setName] = useState(analysis.title || items[0]?.name || "Meal");
  const [portion, setPortion] = useState(
    items.map((i) => i.portion).filter(Boolean).join(", ") || "1 serving",
  );
  const [calories, setCalories] = useState(String(Math.round(analysis.calories)));
  const [protein, setProtein] = useState(String(Math.round(analysis.protein_g)));
  const [carbs, setCarbs] = useState(String(Math.round(analysis.carbs_g)));
  const [fat, setFat] = useState(String(Math.round(analysis.fat_g)));

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
        <div className="sheet-grip" />
        {previewUrl && <img className="thumb" src={previewUrl} alt="Food" />}
        <h2>Review estimate</h2>
        {noFood ? (
          <p className="assumptions">
            No food was clearly detected. You can still enter details manually below,
            or close and try another photo.
          </p>
        ) : (
          <p className="assumptions">
            {analysis.assumptions}
            {lowConfidence && " (Low confidence — please double-check the numbers.)"}
          </p>
        )}

        <div className="field">
          <label>Food</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Portion</label>
          <input value={portion} onChange={(e) => setPortion(e.target.value)} />
        </div>
        <div className="field">
          <label>Calories (kcal)</label>
          <input
            type="number"
            inputMode="numeric"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
          />
        </div>
        <div className="grid-4">
          <div className="field">
            <label>Protein (g)</label>
            <input
              type="number"
              inputMode="numeric"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Carbs (g)</label>
            <input
              type="number"
              inputMode="numeric"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Fat (g)</label>
            <input
              type="number"
              inputMode="numeric"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
            />
          </div>
        </div>

        <div className="fab-row" style={{ marginTop: 8 }}>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={handleSave}>
            Save to log
          </button>
        </div>
      </div>
    </div>
  );
}
