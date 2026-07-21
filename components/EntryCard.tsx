"use client";

import { FoodEntry } from "@/lib/types";

/**
 * Hues for the tile behind a meal, cycled by name. Lives here so Today's list
 * and the expanded History day get the SAME colour for the same dish — they
 * render different components, and keeping two hue tables would guarantee they
 * drifted apart.
 *
 * Hue only: saturation and lightness come from the design, so this is inert in
 * the shipped look and vivid under .v2.
 */
const TILE_HUES = [154, 262, 199, 42, 344, 172, 24, 288];

/**
 * FNV-1a, not the usual `h * 31 + c`. Measured: with `*31` three of five sample
 * meals collided on one hue, because that hash barely mixes its low bits and
 * the modulo reads only those.
 */
export function tileHue(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return TILE_HUES[h % TILE_HUES.length];
}

/** Exported so the alternate design in app/v2 shares one keyword map. */
export function foodEmoji(name: string): string {
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
          src={`/api/photo/${encodeURIComponent(entry.id)}?size=thumb`}
          alt=""
          loading="lazy"
        />
      ) : (
        <div
          className="emoji"
          // Inert in the shipped design, which ignores it; /v2 turns it into a
          // coloured tile. Set here so History's rows match Today's.
          style={{ "--tile-h": tileHue(entry.name) } as React.CSSProperties}
        >
          {foodEmoji(entry.name)}
        </div>
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
