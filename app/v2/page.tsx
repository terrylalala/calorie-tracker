"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./v2.css";
import { Analysis, DEFAULT_GOALS, FoodEntry, Goals } from "@/lib/types";
import { apiHeaders } from "@/lib/api";
import {
  StorageMode,
  detectMode,
  loadAll,
  addEntry as storeAddEntry,
  removeEntry as storeRemoveEntry,
} from "@/lib/dataStore";
import { buildLogsSummary, dateKey, totalsForDate } from "@/lib/nutrition";
import { loadProfile } from "@/lib/storage";
import { putSettings } from "@/lib/dataStore";
import AuthGate from "@/components/AuthGate";
import AnalyzeSheet from "@/components/AnalyzeSheet";
import MealDetailSheet from "@/components/MealDetailSheet";
import ManualEntryForm from "@/components/ManualEntryForm";
// The same components the live app renders. They are re-skinned by the token
// remapping in v2.css, not reimplemented — see the note there.
import HistoryView from "@/components/HistoryView";
import CoachView from "@/components/CoachView";
import SettingsView from "@/components/SettingsView";
import { CapturedImage, downscale } from "@/components/CameraCapture";
import { foodEmoji } from "@/components/EntryCard";

/**
 * Design candidate 2 — a comparison route, not yet a replacement.
 *
 * This now reads and writes the SAME log as the live app. It was sample data
 * until the design was worth judging properly, and a mockup cannot be judged:
 * the questions that decide this design are whether real meal names truncate,
 * whether real photos survive a 44px circle, and whether the layout still works
 * on a day with one meal or eleven. Fixed sample data answers none of them.
 *
 * Only the Today tab exists in this design. The other three deliberately say so
 * rather than rendering something half-built.
 *
 * The live app at / is untouched and still the real entry point; nothing links
 * here.
 *
 * References: palette from Nutro (1), the character capture button from the
 * Food Scanner kit (2), and the information architecture from Vegeat (3) —
 * greeting, macros as dials, meals grouped by sitting.
 */

type Sitting = "Breakfast" | "Lunch" | "Snack" | "Dinner";

/**
 * Meal type is DERIVED from the timestamp, not stored.
 *
 * FoodEntry has no meal field. Adding one would need a migration and would
 * leave every existing row blank, whereas timestamps are already there and
 * already correct — so grouping works retroactively across the whole log.
 */
function sittingFor(iso: string): Sitting {
  const h = new Date(iso).getHours();
  if (h < 11) return "Breakfast";
  if (h < 15) return "Lunch";
  if (h < 18) return "Snack";
  return "Dinner";
}

const ORDER: Sitting[] = ["Breakfast", "Lunch", "Snack", "Dinner"];

/**
 * Palette candidates, selected by data-palette on the root. Temporary: this
 * exists so the choice can be made on a real phone against real data, and the
 * losing options come out afterwards.
 */
const PALETTES = [
  { key: "soft", label: "Soft" },
  { key: "deep", label: "Deep" },
  { key: "warm", label: "Warm" },
  { key: "bold", label: "Bold" },
  { key: "bright", label: "Bright" },
  { key: "vivid", label: "Vivid" },
] as const;

/**
 * Hues for the tile behind each meal, cycled by name.
 *
 * From the bright reference: its colour comes from many DIFFERENT saturated
 * blocks sitting on a white surface — coloured circles behind each icon, vivid
 * product tiles — not from tinting the surface itself. A single grey tile
 * repeated down the list is what made this list read flat.
 *
 * Hue only. Saturation and lightness come from the palette, so the same tiles
 * stay subtle in "soft" and go vivid in "bright".
 */
const TILE_HUES = [154, 262, 199, 42, 344, 172, 24, 288];

/**
 * FNV-1a rather than the usual `h * 31 + c`.
 *
 * Measured, not assumed: with `*31` three of five sample meals landed on the
 * same hue, because that hash barely mixes its low bits and `% 8` reads only
 * those. FNV-1a's xor-then-multiply avalanches, so short similar strings
 * separate.
 */
function tileHue(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return TILE_HUES[h % TILE_HUES.length];
}

const PALETTE_KEY = "v2.palette";

/**
 * The design that ships. Everything else in PALETTES is a candidate kept for
 * comparison while the choice is being made.
 */
const CHOSEN_PALETTE = "bright";

/**
 * The switcher is a decision tool, not a feature, so it renders only in dev.
 *
 * Next inlines NODE_ENV at build time, so in a production build this is the
 * literal `false` and the switcher — along with its handlers — is dropped by
 * dead-code elimination rather than merely hidden with CSS.
 *
 * Production must ALSO ignore the saved choice, not just hide the buttons.
 * Hiding them alone would strand anyone whose localStorage still held a
 * rejected palette, with no control left to change it.
 */
const SHOW_PALETTE_SWITCHER = process.env.NODE_ENV === "development";

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function greetingFor(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

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

export default function V2Page() {
  return (
    <AuthGate>
      <V2Preview />
    </AuthGate>
  );
}

function V2Preview() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState("today");
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [mode, setMode] = useState<StorageMode>("local");
  const [name, setName] = useState<string | null>(null);
  const [palette, setPalette] = useState<string>(CHOSEN_PALETTE);

  // photo flow, mirroring the live app's
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [captured, setCaptured] = useState<CapturedImage | null>(null);
  const [detail, setDetail] = useState<FoodEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    // Remembered so the choice survives a reload while comparing — but only
    // where the switcher exists. In production the shipped palette wins over
    // any leftover saved value, since there would be no way to undo it.
    if (SHOW_PALETTE_SWITCHER) {
      try {
        const saved = window.localStorage.getItem(PALETTE_KEY);
        if (saved && PALETTES.some((p) => p.key === saved)) setPalette(saved);
      } catch {
        // Private browsing can throw here; the default palette is fine.
      }
    }
    (async () => {
      const detected = await detectMode();
      const data = await loadAll(detected);
      if (cancelled) return;
      setMode(data.mode);
      setEntries(data.entries);
      setGoals(data.goals);
      if (data.error) setError(data.error);
      setMounted(true);
    })();
    // The greeting name comes from the account, not a hardcoded string. Failing
    // to reach it is not an error worth showing — the greeting just drops the
    // name and reads fine without it.
    fetch("/api/account")
      .then((r) => r.json())
      .then((s) => {
        if (!cancelled) setName(s?.user?.name?.split(" ")[0] ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so picking the same file again re-triggers onChange.
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    let img: CapturedImage;
    try {
      img = await downscale(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process the image.");
      return;
    }

    setError(null);
    setPreviewUrl(img.dataUrl);
    setCaptured(img);
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ imageBase64: img.base64, mediaType: img.mediaType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not analyze the photo.");
        setPreviewUrl(undefined);
      } else {
        setAnalysis(data.analysis as Analysis);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
      setPreviewUrl(undefined);
    } finally {
      setAnalyzing(false);
    }
  }

  async function addEntry(entry: FoodEntry) {
    const next = [entry, ...entries];
    const photo =
      entry.source === "photo" && captured
        ? {
            base64: captured.base64,
            mediaType: captured.mediaType,
            thumbBase64: captured.thumbBase64,
          }
        : undefined;
    setEntries(next);
    setAnalysis(null);
    setPreviewUrl(undefined);
    setCaptured(null);
    setShowManual(false);
    setTab("today");
    try {
      await storeAddEntry(mode, entry, next, photo);
      if (photo) {
        // Re-read so the new row comes back with hasPhoto set.
        const fresh = await loadAll(mode);
        setEntries(fresh.entries);
      }
    } catch {
      setError("Saved on this device, but couldn't reach the database.");
    }
  }

  async function deleteEntry(id: string) {
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    try {
      await storeRemoveEntry(mode, id, next);
    } catch {
      setError("Removed on this device, but couldn't reach the database.");
    }
  }

  async function updateGoals(g: Goals) {
    setGoals(g);
    try {
      await putSettings(mode, { goals: g, profile: loadProfile() });
    } catch {
      setError("Saved on this device, but couldn't reach the database.");
    }
  }

  const today = dateKey();
  const totals = useMemo(() => totalsForDate(entries, today), [entries, today]);
  const logsSummary = useMemo(
    () => buildLogsSummary(entries, goals, 14),
    [entries, goals],
  );
  const todayEntries = useMemo(
    () => entries.filter((e) => e.date === today),
    [entries, today],
  );

  // Four dials, as in the shipped design. Each keeps its own colour so the row
  // is scannable without reading the labels.
  const dials = [
    { key: "cal", name: "Kcal", have: totals.calories, goal: goals.calories, colour: "var(--v2-cyan-deep)" },
    { key: "pro", name: "Protein", have: totals.protein_g, goal: goals.protein_g, colour: "var(--v2-cyan)" },
    { key: "carb", name: "Carbs", have: totals.carbs_g, goal: goals.carbs_g, colour: "var(--v2-yellow)" },
    { key: "fat", name: "Fat", have: totals.fat_g, goal: goals.fat_g, colour: "var(--v2-pink)" },
  ];

  const R = 25;
  const C = 2 * Math.PI * R;

  const grouped = ORDER.map((s) => ({
    sitting: s,
    meals: todayEntries
      .filter((e) => sittingFor(e.timestamp) === s)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
  })).filter((g) => g.meals.length > 0);

  // The greeting depends on the current time, so it can't be rendered on the
  // server without risking a hydration mismatch. Everything waits for mount.
  if (!mounted) {
    return (
      <div className="v2">
        <div className="v2-loading">
          <span className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="v2" data-palette={palette} data-tab={tab}>
      {/* Greeting and rings share a band. It is transparent in most palettes;
          "bright" fills it with saturated colour so the white rings card sits
          ON the colour, which is how the reference gets its brightness without
          tinting the page. */}
      <div className="v2-hero">
        <header className="v2-greet">
          <div>
            <p className="v2-greet-hi">{greetingFor(new Date())}</p>
            <h1 className="v2-greet-name">{name ?? "there"}</h1>
          </div>
          {/* Only when there is a name. A "?" in the circle reads as an error
              rather than as "signed out", which is all it would mean. */}
          {name && <div className="v2-avatar">{name.slice(0, 1).toUpperCase()}</div>}
        </header>
      </div>

      {error && <div className="v2-error">{error}</div>}

      {tab === "today" ? (
        <>
          <section className="v2-rings">
            {dials.map((d) => {
              const pct = d.goal > 0 ? Math.min(1, d.have / d.goal) : 0;
              return (
                <div
                  className="v2-ring"
                  key={d.key}
                  // Exposed to CSS so a palette can tile each dial in its own
                  // colour without duplicating the four colours in the stylesheet.
                  style={{ "--ring-c": d.colour } as React.CSSProperties}
                >
                  <div className="v2-ring-dial">
                    <svg width="62" height="62" viewBox="0 0 62 62">
                      {/* The unfilled track keeps some of the ring's own
                          colour. A ring at 13% is 87% track, so a grey track
                          means the screen reads grey until the day is nearly
                          over — which is exactly what looked washed out. */}
                      <circle
                        cx="31" cy="31" r={R} fill="none" strokeWidth="6"
                        stroke={`color-mix(in srgb, ${d.colour} var(--v2-track-tint), var(--v2-track-base))`}
                      />
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
                      <div className="v2-ring-num">{Math.round(d.have)}</div>
                      <div className="v2-ring-goal">/{d.goal}</div>
                    </div>
                  </div>
                  <div className="v2-ring-name">{d.name}</div>
                </div>
              );
            })}
          </section>

          <section className="v2-capture-card">
            <button
              className="v2-face-btn"
              onClick={() => cameraRef.current?.click()}
              disabled={analyzing}
              aria-label="Take a photo of your meal"
            >
              <FaceIcon />
            </button>
            <h2 className="v2-capture-title">
              {analyzing ? "Reading your photo…" : "Log a meal"}
            </h2>
            <p className="v2-capture-sub">
              {analyzing
                ? "This usually takes a few seconds"
                : "Snap a photo — the rest is filled in for you"}
            </p>
            <div className="v2-capture-actions">
              <button
                className="v2-btn primary"
                onClick={() => cameraRef.current?.click()}
                disabled={analyzing}
              >
                Take photo
              </button>
              <button
                className="v2-btn"
                onClick={() => libraryRef.current?.click()}
                disabled={analyzing}
              >
                Choose photo
              </button>
            </div>
            {/* The only path that never touches Gemini. Without it this screen
                cannot log anything at all when the model is down — which it was
                for five straight hours on 20 July. */}
            <button
              className="v2-manual"
              onClick={() => setShowManual(true)}
              disabled={analyzing}
            >
              Add manually instead
            </button>
            {/* capture="environment" opens the camera directly on a phone; the
                second input has no capture attribute so it opens the library. */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={handleFile}
            />
            <input
              ref={libraryRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleFile}
            />
          </section>

          <div className="v2-section">
            <h2>Today&rsquo;s meals</h2>
            <span>
              {todayEntries.length} logged
            </span>
          </div>

          {grouped.length === 0 ? (
            <p className="v2-empty">
              Nothing logged yet today. Take a photo above to start.
            </p>
          ) : (
            grouped.map((g) => (
              <div className="v2-sitting" key={g.sitting}>
                <div className="v2-sitting-head">
                  <span className={`v2-chip ${g.sitting.toLowerCase()}`}>{g.sitting}</span>
                  <span className="v2-sitting-kcal">
                    {Math.round(g.meals.reduce((n, m) => n + m.calories, 0))} kcal
                  </span>
                </div>
                {g.meals.map((m) => (
                  <button
                    className="v2-meal"
                    key={m.id}
                    onClick={() => setDetail(m)}
                  >
                    {/* ?size=thumb: a 320px copy, not the full photo. Meals
                        logged before thumbnails existed fall back server-side. */}
                    {m.hasPhoto ? (
                      <img
                        className="v2-thumb"
                        src={`/api/photo/${encodeURIComponent(m.id)}?size=thumb`}
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="v2-thumb"
                        style={{ "--tile-h": tileHue(m.name) } as React.CSSProperties}
                      >
                        {foodEmoji(m.name)}
                      </div>
                    )}
                    <div className="v2-meal-body">
                      <p className="v2-meal-name">{m.name}</p>
                      <p className="v2-meal-sub">
                        {hhmm(m.timestamp)}
                        {m.portion ? ` · ${m.portion}` : ""}
                      </p>
                    </div>
                    <div className="v2-meal-kcal">{Math.round(m.calories)}</div>
                  </button>
                ))}
              </div>
            ))
          )}

          {SHOW_PALETTE_SWITCHER && (
          <div className="v2-palette" role="group" aria-label="Colour palette">
            {PALETTES.map((p) => (
              <button
                key={p.key}
                className={`v2-palette-btn ${palette === p.key ? "active" : ""}`}
                aria-pressed={palette === p.key}
                onClick={() => {
                  setPalette(p.key);
                  try {
                    window.localStorage.setItem(PALETTE_KEY, p.key);
                  } catch {
                    // Not worth surfacing; the choice just won't persist.
                  }
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          )}

          <div className="v2-banner">
            <b>Design preview — this is your real log.</b> Meals logged here are
            saved for real and show up in the live app at <b>/</b>, which is
            unchanged. Only the Today tab exists in this design.
            {SHOW_PALETTE_SWITCHER && " The buttons above switch palettes (development only)."}
          </div>
        </>
      ) : tab === "history" ? (
        <HistoryView
          entries={entries}
          goals={goals}
          onOpen={setDetail}
          onDelete={deleteEntry}
        />
      ) : tab === "coach" ? (
        <CoachView logsSummary={logsSummary} hasData={entries.length > 0} />
      ) : (
        <SettingsView goals={goals} onSave={updateGoals} mode={mode} />
      )}

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

      {analysis && (
        <AnalyzeSheet
          analysis={analysis}
          previewUrl={previewUrl}
          onSave={addEntry}
          onClose={() => {
            setAnalysis(null);
            setPreviewUrl(undefined);
            setCaptured(null);
          }}
        />
      )}

      {showManual && (
        <ManualEntryForm onSave={addEntry} onClose={() => setShowManual(false)} />
      )}

      {detail && (
        <MealDetailSheet
          entry={detail}
          onDelete={deleteEntry}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
