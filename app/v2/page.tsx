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

/** Reference 2's character, as SVG so it stays crisp and takes the palette. */
function FaceIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
      {/* scan-frame corners */}
      <g stroke="#fff" strokeWidth="2.6" strokeLinecap="round">
        <path d="M4 12V7a3 3 0 0 1 3-3h5" />
        <path d="M28 4h5a3 3 0 0 1 3 3v5" />
        <path d="M36 28v5a3 3 0 0 1-3 3h-5" />
        <path d="M12 36H7a3 3 0 0 1-3-3v-5" />
      </g>
      {/* eyes */}
      <circle cx="15" cy="17.5" r="2.3" fill="#fff" />
      <circle cx="25" cy="17.5" r="2.3" fill="#fff" />
      {/* open smile */}
      <path
        d="M13.5 23.5c1.6 3 4 4.5 6.5 4.5s4.9-1.5 6.5-4.5z"
        fill="#fff"
      />
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
  const left = Math.max(0, GOALS.calories - eaten);
  const pct = Math.min(1, eaten / GOALS.calories);

  // Sample macro totals, chosen to be plausible against the meals above.
  const macros = [
    { key: "pro", name: "Protein", have: 62, goal: GOALS.protein_g, unit: "g" },
    { key: "carb", name: "Carbs", have: 168, goal: GOALS.carbs_g, unit: "g" },
    { key: "fat", name: "Fat", have: 41, goal: GOALS.fat_g, unit: "g" },
  ];

  const R = 46;
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

      <section className="v2-hero">
        <div className="v2-hero-top">
          <div className="v2-ring">
            <svg width="104" height="104" viewBox="0 0 104 104">
              <circle cx="52" cy="52" r={R} fill="none" stroke="#edf0f3" strokeWidth="9" />
              <circle
                cx="52" cy="52" r={R} fill="none"
                stroke="var(--v2-cyan)" strokeWidth="9" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
              />
            </svg>
            <div className="v2-ring-label">
              <div className="v2-ring-num">{left.toLocaleString()}</div>
              <div className="v2-ring-unit">kcal left</div>
            </div>
          </div>

          <div className="v2-hero-side">
            <p className="v2-hero-eyebrow">Today</p>
            <p className="v2-hero-line">
              <strong>{eaten.toLocaleString()}</strong> of{" "}
              {GOALS.calories.toLocaleString()} kcal eaten across{" "}
              <strong>{SAMPLE.length}</strong> meals.
            </p>
          </div>
        </div>

        <div className="v2-macros">
          {macros.map((m) => (
            <div key={m.key}>
              <div className="v2-macro-head">
                <span className="v2-macro-name">{m.name}</span>
                <span className="v2-macro-val">
                  {m.have} / {m.goal}
                  {m.unit}
                </span>
              </div>
              <div className={`v2-bar ${m.key}`}>
                <span style={{ width: `${Math.min(100, (m.have / m.goal) * 100)}%` }} />
              </div>
            </div>
          ))}
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

          <button className="v2-capture" aria-label="Log a meal">
            <FaceIcon />
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
