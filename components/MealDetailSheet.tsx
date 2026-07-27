"use client";

import { useState } from "react";
import { FoodEntry } from "@/lib/types";

/** Tap a logged meal to see its photo, per-item breakdown and full macros. */
export default function MealDetailSheet({
  entry,
  onDelete,
  onEdit,
  onClose,
}: {
  entry: FoodEntry;
  onDelete: (id: string) => void;
  onEdit: (entry: FoodEntry) => void;
  onClose: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const time = new Date(entry.timestamp).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  const items = entry.items ?? [];

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Meal details</h2>
          <button className="close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="sheet-scroll">
          {entry.hasPhoto && !imgFailed && (
            // Served through our own route, which checks you own this meal.
            <img
              className="thumb"
              src={`/api/photo/${encodeURIComponent(entry.id)}`}
              alt={entry.name}
              onError={() => setImgFailed(true)}
            />
          )}

          <h3 className="detail-name">{entry.name}</h3>
          <p className="detail-meta">
            {time}
            {entry.portion ? ` · ${entry.portion}` : ""}
          </p>

          <div className="macro-boxes" style={{ marginTop: 14 }}>
            <div className="mbox cal">
              <div className="mval">{entry.calories}</div>
              <div className="u">kcal</div>
            </div>
            <div className="mbox pro">
              <div className="mval">{entry.protein_g}</div>
              <div className="u">P</div>
            </div>
            <div className="mbox carb">
              <div className="mval">{entry.carbs_g}</div>
              <div className="u">C</div>
            </div>
            <div className="mbox fat">
              <div className="mval">{entry.fat_g}</div>
              <div className="u">F</div>
            </div>
          </div>

          {items.length > 0 && (
            <>
              <p className="label-sm" style={{ marginTop: 20 }}>
                What was in it
              </p>
              {items.map((it, i) => (
                <div className="item-row" key={`${it.name}-${i}`}>
                  <div className="item-info">
                    <div className="item-name">{it.name}</div>
                    <div className="item-meta">
                      {it.portion}
                      {it.portion ? " · " : ""}P {it.protein_g} · C {it.carbs_g} · F{" "}
                      {it.fat_g}
                    </div>
                  </div>
                  <div className="item-cal">{it.calories}</div>
                </div>
              ))}
            </>
          )}

          {entry.note && <p className="note-italic">{entry.note}</p>}

          {entry.source === "photo" && !entry.hasPhoto && (
            <p className="assumptions" style={{ marginTop: 14 }}>
              No photo saved for this meal.
            </p>
          )}
        </div>

        <div className="sheet-footer">
          {confirming ? (
            <div className="fab-row">
              <button className="btn" onClick={() => setConfirming(false)}>
                Keep
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  onDelete(entry.id);
                  onClose();
                }}
              >
                Delete meal
              </button>
            </div>
          ) : (
            <div className="fab-row">
              <button className="btn" onClick={() => setConfirming(true)}>
                Delete
              </button>
              <button className="btn primary" onClick={() => onEdit(entry)}>
                Edit
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
