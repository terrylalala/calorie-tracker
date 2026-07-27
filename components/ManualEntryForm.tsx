"use client";

import { useState } from "react";
import { FoodEntry } from "@/lib/types";
import { dateKey } from "@/lib/nutrition";
import { WhenParts, localParts, partsToDate } from "@/lib/when";
import WhenField from "@/components/WhenField";

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Manual (no-photo) food entry sheet.
 *
 * `initialWhen` switches this into backfill mode: a When field appears and the
 * entry is stamped with the chosen date/time instead of now. Omitted on the
 * normal Today flow, which stays "log now" with no extra field.
 */
export default function ManualEntryForm({
  onSave,
  onClose,
  initialWhen,
}: {
  onSave: (entry: FoodEntry) => void;
  onClose: () => void;
  initialWhen?: Date;
}) {
  const [name, setName] = useState("");
  const [portion, setPortion] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [when, setWhen] = useState<WhenParts | null>(
    initialWhen ? localParts(initialWhen) : null,
  );

  const num = (s: string) => {
    const n = parseFloat(s);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const canSave = name.trim().length > 0 && num(calories) >= 0 && calories.trim() !== "";

  function handleSave() {
    const at = when ? partsToDate(when) : new Date();
    onSave({
      id: newId(),
      timestamp: at.toISOString(),
      date: dateKey(at),
      name: name.trim(),
      portion: portion.trim(),
      calories: num(calories),
      protein_g: num(protein),
      carbs_g: num(carbs),
      fat_g: num(fat),
      source: "manual",
    });
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-scroll">
        <h2>{when ? "Add a past meal" : "Add food manually"}</h2>
        <p className="assumptions">
          {when
            ? "Set when you ate it, then enter what you can — only a name and calories are required."
            : "Enter what you can — only a name and calories are required."}
        </p>

        {when && <WhenField value={when} onChange={setWhen} />}

        <div className="field">
          <label>Food *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Greek yogurt with berries"
          />
        </div>
        <div className="field">
          <label>Portion</label>
          <input
            value={portion}
            onChange={(e) => setPortion(e.target.value)}
            placeholder="e.g. 1 bowl"
          />
        </div>
        <div className="field">
          <label>Calories (kcal) *</label>
          <input
            type="number"
            inputMode="numeric"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="0"
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
              placeholder="0"
            />
          </div>
          <div className="field">
            <label>Carbs (g)</label>
            <input
              type="number"
              inputMode="numeric"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="field">
            <label>Fat (g)</label>
            <input
              type="number"
              inputMode="numeric"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        </div>
        <div className="sheet-footer">
          <div className="fab-row">
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" disabled={!canSave} onClick={handleSave}>
              Save to log
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
