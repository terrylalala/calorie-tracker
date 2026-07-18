"use client";

import { FoodEntry } from "@/lib/types";

function foodEmoji(name: string): string {
  const n = name.toLowerCase();
  const map: [string, string][] = [
    ["salad", "🥗"],
    ["burger", "🍔"],
    ["pizza", "🍕"],
    ["rice", "🍚"],
    ["chicken", "🍗"],
    ["egg", "🥚"],
    ["fish", "🐟"],
    ["sushi", "🍣"],
    ["pasta", "🍝"],
    ["noodle", "🍜"],
    ["sandwich", "🥪"],
    ["taco", "🌮"],
    ["burrito", "🌯"],
    ["yogurt", "🥛"],
    ["milk", "🥛"],
    ["fruit", "🍎"],
    ["apple", "🍎"],
    ["banana", "🍌"],
    ["berries", "🫐"],
    ["coffee", "☕"],
    ["smoothie", "🥤"],
    ["soup", "🍲"],
    ["steak", "🥩"],
    ["bread", "🍞"],
    ["oat", "🥣"],
    ["cereal", "🥣"],
    ["bowl", "🥣"],
    ["cookie", "🍪"],
    ["cake", "🍰"],
    ["chocolate", "🍫"],
    ["beer", "🍺"],
    ["wine", "🍷"],
  ];
  for (const [k, e] of map) if (n.includes(k)) return e;
  return "🍽️";
}

export default function EntryCard({
  entry,
  onDelete,
  onOpen,
}: {
  entry: FoodEntry;
  onDelete: (id: string) => void;
  onOpen?: (entry: FoodEntry) => void;
}) {
  const time = new Date(entry.timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <div
      className={`entry${onOpen ? " tappable" : ""}`}
      onClick={onOpen ? () => onOpen(entry) : undefined}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(entry);
              }
            }
          : undefined
      }
    >
      {entry.hasPhoto ? (
        <img
          className="entry-photo"
          src={`/api/photo/${encodeURIComponent(entry.id)}`}
          alt=""
          loading="lazy"
        />
      ) : (
        <div className="emoji">{foodEmoji(entry.name)}</div>
      )}
      <div className="info">
        <div className="name">{entry.name}</div>
        <div className="meta">
          {time}
          {entry.portion ? ` · ${entry.portion}` : ""}
        </div>
        <div className="meta">
          P {entry.protein_g} · C {entry.carbs_g} · F {entry.fat_g}
        </div>
      </div>
      <div className="kcal">{entry.calories}</div>
      <button
        className="del"
        aria-label="Delete entry"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(entry.id);
        }}
      >
        ✕
      </button>
    </div>
  );
}
