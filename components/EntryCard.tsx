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
}: {
  entry: FoodEntry;
  onDelete: (id: string) => void;
}) {
  const time = new Date(entry.timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <div className="entry">
      <div className="emoji">{foodEmoji(entry.name)}</div>
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
        onClick={() => onDelete(entry.id)}
      >
        ✕
      </button>
    </div>
  );
}
