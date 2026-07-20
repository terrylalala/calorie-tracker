"use client";

import { useState } from "react";
import "./v2.css";

/**
 * Design candidate 2 — a comparison route, not a feature.
 *
 * Deliberately NOT wired to the database or any API: it renders fixed sample
 * data so it can be judged on a phone without touching the real log, spending a
 * billed Gemini call, or being able to write anything. Wire it up only if this
 * design wins.
 *
 * The live app at / is untouched; nothing links here.
 *
 * References: palette from Nutro (1), the character capture button from the
 * Food Scanner kit (2), and the information architecture from Vegeat (3) —
 * greeting, one hero number, macros as bars, meals grouped by sitting.
 */

const GOALS = { calories: 1970, protein_g: 144, carbs_g: 226, fat_g: 55 };

/** Fixed sample data. Real-looking, so spacing and truncation get a fair test. */
const SAMPLE = [
  { name: "Kelp and Winter Melon Soup", portion: "1.5 cups", kcal: 145, at: "08:20", emoji: "🥣", tint: "#fff4d6" },
  { name: "Wholemeal toast with peanut butter", portion: "2 slices", kcal: 320, at: "08:35", emoji: "🍞", tint: "#ffe9c9" },
  { name: "Char siu rice with greens", portion: "1 plate", kcal: 780, at: "13:05", emoji: "🍛", tint: "#d8f3f1" },
  { name: "Iced lemon tea", portion: "1 glass", kcal: 90, at: "15:40", emoji: "🧋", tint: "#ffe0e8" },
];

type Sitting = "Breakfast" | "Lunch" | "Dinner" | "Snack";

/**
 * Meal type is DERIVED from the time, not stored.
 *
 * FoodEntry has no meal field. Adding one would need a migration and would
 * leave every existing row blank, whereas timestamps are already there and
 * already correct — so grouping works retroactively on the whole log.
 */
function sittingFor(hhmm: string): Sitting {
  const h = Number(hhmm.slice(0, 2));
  if (h < 11) return "Breakfast";
  if (h < 15) return "Lunch";
  if (h < 18) return "Snack";
  return "Dinner";
}

const ORDER: Sitting[] = ["Breakfast", "Lunch", "Snack", "Dinner"];

/**
 * The character from reference 2, drawn larger and rounder.
 *
 * Kawaii faces read as cute because of specific proportions, not just "a
 * smile": eyes set wide and low, glossy highlights, a small open mouth with a
 * tongue, and blush. The first attempt was a flat white smile at 34px in the
 * tab bar and lost all of that — at this size the features actually land.
 *
 * SVG rather than an image so it stays crisp and inherits the palette.
 */
function FaceIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {/* rounded card the face sits on */}
      <rect x="6" y="6" width="52" height="52" rx="17" fill="#fff" />

      {/* scan-frame corners, so it still reads as "capture" */}
      <g stroke="var(--v2-cyan-deep)" strokeWidth="3.4" strokeLinecap="round">
        <path d="M13 22v-4a5 5 0 0 1 5-5h4" />
        <path d="M42 13h4a5 5 0 0 1 5 5v4" />
        <path d="M51 42v4a5 5 0 0 1-5 5h-4" />
        <path d="M22 51h-4a5 5 0 0 1-5-5v-4" />
      </g>

      {/* blush, under the eyes and set wide */}
      <ellipse cx="19.5" cy="38.5" rx="4.6" ry="3" fill="#ff8ba7" opacity="0.5" />
      <ellipse cx="44.5" cy="38.5" rx="4.6" ry="3" fill="#ff8ba7" opacity="0.5" />

      {/* eyes: tall ovals with a highlight, which is what makes them read as glossy */}
      <ellipse cx="24.5" cy="30" rx="4.1" ry="5.2" fill="#2b2f38" />
      <ellipse cx="39.5" cy="30" rx="4.1" ry="5.2" fill="#2b2f38" />
      <circle cx="26.1" cy="27.8" r="1.5" fill="#fff" />
      <circle cx="41.1" cy="27.8" r="1.5" fill="#fff" />

      {/* small open mouth with a tongue */}
      <path d="M27 39.5h10a5 5 0 0 1-10 0z" fill="#2b2f38" />
      <path d="M30.6 43.4a5 5 0 0 0 2.9.9 5 5 0 0 0 1.9-.4 2.4 2.4 0 0 0-4.8-.5z" fill="#ff8ba7" />
    </svg>
  );
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function V2Preview() {
  const [tab, setTab] = useState("today");

  const eaten = SAMPLE.reduce((n, m) => n + m.kcal, 0);

  // Four dials, as in the shipped design. Each keeps its own colour so the row
  // is scannable without reading the labels.
  const dials = [
    { key: "cal", name: "Kcal", have: eaten, goal: GOALS.calories, colour: "var(--v2-cyan-deep)" },
    { key: "pro", name: "Protein", have: 62, goal: GOALS.protein_g, colour: "var(--v2-cyan)" },
    { key: "carb", name: "Carbs", have: 168, goal: GOALS.carbs_g, colour: "var(--v2-yellow)" },
    { key: "fat", name: "Fat", have: 41, goal: GOALS.fat_g, colour: "var(--v2-pink)" },
  ];

  const R = 25;
  const C = 2 * Math.PI * R;

  const grouped = ORDER.map((s) => ({
    sitting: s,
    meals: SAMPLE.filter((m) => sittingFor(m.at) === s),
  })).filter((g) => g.meals.length > 0);

  return (
    <div className="v2">
      <header className="v2-greet">
        <div>
          <p className="v2-greet-hi">Good evening</p>
          <h1 className="v2-greet-name">Terry</h1>
        </div>
        <div className="v2-avatar">T</div>
      </header>

      <section className="v2-rings">
        {dials.map((d) => {
          const pct = Math.min(1, d.have / d.goal);
          return (
            <div className="v2-ring" key={d.key}>
              <div className="v2-ring-dial">
                <svg width="62" height="62" viewBox="0 0 62 62">
                  <circle cx="31" cy="31" r={R} fill="none" stroke="#edf0f3" strokeWidth="6" />
                  <circle
                    cx="31" cy="31" r={R} fill="none"
                    stroke={d.colour} strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
                  />
                </svg>
                {/* No thousands separator inside the dials. "1,335" measured
                    43px in a 62px ring — it fits, but only just, and the comma
                    buys nothing at this size. */}
                <div className="v2-ring-mid">
                  <div className="v2-ring-num">{d.have}</div>
                  <div className="v2-ring-goal">/{d.goal}</div>
                </div>
              </div>
              <div className="v2-ring-name">{d.name}</div>
            </div>
          );
        })}
      </section>

      <section className="v2-capture-card">
        <button className="v2-face-btn" aria-label="Take a photo of your meal">
          <FaceIcon />
        </button>
        <h2 className="v2-capture-title">Log a meal</h2>
        <p className="v2-capture-sub">Snap a photo &mdash; the rest is filled in for you</p>
        <div className="v2-capture-actions">
          <button className="v2-btn primary">Take photo</button>
          <button className="v2-btn">Choose photo</button>
        </div>
      </section>

      <div className="v2-section">
        <h2>Today&rsquo;s meals</h2>
        <span>{SAMPLE.length} logged</span>
      </div>

      {grouped.map((g) => (
        <div className="v2-sitting" key={g.sitting}>
          <div className="v2-sitting-head">
            <span className={`v2-chip ${g.sitting.toLowerCase()}`}>{g.sitting}</span>
            <span className="v2-sitting-kcal">
              {g.meals.reduce((n, m) => n + m.kcal, 0)} kcal
            </span>
          </div>
          {g.meals.map((m) => (
            <div className="v2-meal" key={m.name}>
              <div className="v2-thumb" style={{ background: m.tint }}>
                {m.emoji}
              </div>
              <div className="v2-meal-body">
                <p className="v2-meal-name">{m.name}</p>
                <p className="v2-meal-sub">
                  {m.at} · {m.portion}
                </p>
              </div>
              <div className="v2-meal-kcal">{m.kcal}</div>
            </div>
          ))}
        </div>
      ))}

      <div className="v2-banner">
        <b>Design preview.</b> Sample data only — nothing here reads or writes
        your real log. The live app is unchanged at <b>/</b>.
      </div>

      <nav className="v2-nav">
        <div className="v2-nav-inner">
          <button
            className={`v2-tab ${tab === "today" ? "active" : ""}`}
            onClick={() => setTab("today")}
          >
            <NavIcon d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
            Today
          </button>
          <button
            className={`v2-tab ${tab === "history" ? "active" : ""}`}
            onClick={() => setTab("history")}
          >
            <NavIcon d="M12 7v5l3 2M3 12a9 9 0 1 0 9-9 9 9 0 0 0-9 9z" />
            History
          </button>

          <button
            className={`v2-tab ${tab === "coach" ? "active" : ""}`}
            onClick={() => setTab("coach")}
          >
            <NavIcon d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6.1L12 16.8 6.6 19.7l1.2-6.1L3.3 9.4l6.1-.8z" />
            Coach
          </button>
          <button
            className={`v2-tab ${tab === "settings" ? "active" : ""}`}
            onClick={() => setTab("settings")}
          >
            <NavIcon d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4z" />
            Settings
          </button>
        </div>
      </nav>
    </div>
  );
}
