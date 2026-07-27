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
 * Manual food entry sheet, in three modes:
 *
 * - normal Today flow (no props): "log now", no When field;
 * - backfill (`initialWhen`): a When field appears, stamped with a past date;
 * - edit (`editEntry`): pre-filled from an existing meal; saving KEEPS its id so
 *   the API upserts in place. A When field appears so the time can be corrected.
 *
 * Edit preserves the parts this form doesn't touch — id, photo, per-item
 * breakdown, source — by spreading `editEntry` first (see handleSave). That is
 * why editing a photo meal keeps its photo: the save carries no new image, and
 * the API upsert coalesces the photo columns to their existing values.
 */
export default function ManualEntryForm({
  onSave,
  onClose,
  initialWhen,
  editEntry,
}: {
  onSave: (entry: FoodEntry) => void;
  onClose: () => void;
  initialWhen?: Date;
  editEntry?: FoodEntry;
}) {
  const editing = !!editEntry;
  const [name, setName] = useState(editEntry?.name ?? "");
  const [portion, setPortion] = useState(editEntry?.portion ?? "");
  const [calories, setCalories] = useState(
    editEntry ? String(editEntry.calories) : "",
  );
  const [protein, setProtein] = useState(
    editEntry ? String(editEntry.protein_g) : "",
  );
  const [carbs, setCarbs] = useState(editEntry ? String(editEntry.carbs_g) : "");
  const [fat, setFat] = useState(editEntry ? String(editEntry.fat_g) : "");
  const [when, setWhen] = useState<WhenParts | null>(
    editEntry
      ? localParts(new Date(editEntry.timestamp))
      : initialWhen
        ? localParts(initialWhen)
        : null,
  );

  const num = (s: string) => {
    const n = parseFloat(s);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const canSave = name.trim().length > 0 && num(calories) >= 0 && calories.trim() !== "";

  function handleSave() {
    const at = when ? partsToDate(when) : new Date();
    const fields = {
      timestamp: at.toISOString(),
      date: dateKey(at),
      name: name.trim(),
      portion: portion.trim(),
      calories: num(calories),
      protein_g: num(protein),
      carbs_g: num(carbs),
      fat_g: num(fat),
    };
    onSave(
      editEntry
        ? { ...editEntry, ...fields } // keep id, photo, items, source, note
        : { id: newId(), source: "manual", ...fields },
    );
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-scroll">
        <h2>{editing ? "Edit meal" : when ? "Add a past meal" : "Add food manually"}</h2>
        <p className="assumptions">
          {editing
            ? "Change anything below and save. A name and calories are required."
            : when
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
              {editing ? "Save changes" : "Save to log"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
