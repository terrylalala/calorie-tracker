"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./bright.css";
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
import { defaultBackfillWhen } from "@/lib/when";
import { loadProfile } from "@/lib/storage";
import { putSettings } from "@/lib/dataStore";
import AuthGate from "@/components/AuthGate";
import AnalyzeSheet from "@/components/AnalyzeSheet";
import MealDetailSheet from "@/components/MealDetailSheet";
import ManualEntryForm from "@/components/ManualEntryForm";
// History, Coach and Settings are shared with nothing else now, but they stay
// separate components: they are re-skinned by the token remapping in
// bright.css rather than reimplemented, and that seam is what kept one
// implementation while two designs existed.
import HistoryView from "@/components/HistoryView";
import CoachView from "@/components/CoachView";
import SettingsView from "@/components/SettingsView";
import { CapturedImage, downscale } from "@/components/CameraCapture";
import { foodEmoji, tileHue } from "@/components/EntryCard";

/**
 * The app. Rendered at / and, for anyone who bookmarked it during the
 * comparison, at /v2.
 *
 * Chosen on 21 July 2026 after being built at /v2 and judged on a phone against
 * real data. The previous cream/serif design is tagged design/cream-serif-v1
 * and is one revert away.
 *
 * Two things this design is built on, both learned by getting them wrong first:
 *
 * 1. Colour belongs in BLOCKS on a light surface — a filled band, coloured
 *    tiles behind items, a filled card for the primary action. Tinting the
 *    background instead only lowers contrast against the cards on top of it,
 *    which reads muted rather than bright.
 * 2. An unfilled ring keeps some of its own colour (--v2-track-tint). A ring at
 *    13% is 87% track, so a grey track makes the screen look washed out for
 *    most of a day and only come alive once goals are nearly met.
 *
 * The counterweight to both: body text needs dark ink on a light surface no
 * matter which hue a tab carries. Coach's advice was briefly white-on-pink at
 * about 2:1 for exactly this reason.
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

/*
 * Tile hues now live in EntryCard alongside foodEmoji, so Today's list and the
 * expanded History day colour the same dish identically. They render different
 * components; two hue tables would have drifted.
 */

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

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

/**
 * The three-way "how do you want to add it?" chooser shown when backfilling a
 * past meal from History. It reuses the exact same three inputs as the Today
 * capture card (camera, library, manual) so there is one logging pipeline, not
 * a second parallel one — the only difference downstream is that a past date is
 * already seeded, which makes the sheets show their When field.
 */
function BackfillChooser({
  onClose,
  onPhoto,
  onLibrary,
  onManual,
}: {
  onClose: () => void;
  onPhoto: () => void;
  onLibrary: () => void;
  onManual: () => void;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-scroll">
          <h2>Add a past meal</h2>
          <p className="assumptions">
            Snap or pick a photo and the AI fills in the food — you set the day.
            Or type it in yourself.
          </p>
          <div className="v2-capture-actions" style={{ marginTop: 8 }}>
            <button className="v2-btn primary" onClick={onPhoto}>
              Take photo
            </button>
            <button className="v2-btn" onClick={onLibrary}>
              Choose photo
            </button>
          </div>
          <button className="v2-manual" onClick={onManual}>
            Add manually instead
          </button>
        </div>
        <div className="sheet-footer">
          <div className="fab-row">
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
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

export default function BrightApp() {
  return (
    <AuthGate>
      <Tracker />
    </AuthGate>
  );
}

function Tracker() {
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
  const [notice, setNotice] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  // Backfill: non-null seeds the logging sheets with a past date and makes them
  // show a "When" field. Null is the normal "log now" path. It is set from the
  // History tab's "Add a past meal" button and cleared after a save or cancel.
  const [backfillWhen, setBackfillWhen] = useState<Date | null>(null);
  const [showBackfillChooser, setShowBackfillChooser] = useState(false);

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
      // Restored from the previous design. The first load on a new device
      // MERGES that device's local-only entries into the database, and saying
      // nothing about it makes a silent bulk write look like nothing happened.
      if (data.migrated) {
        setNotice(
          `Synced ${data.migrated} existing ${data.migrated === 1 ? "entry" : "entries"} to your database.`,
        );
      }
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
        // Say so when the backup model answered. The estimate is still worth
        // having, but presenting it as identical to the usual one would be
        // quietly overstating it.
        if (data.fallbackModel) {
          setNotice(
            "The usual AI model was busy, so a smaller backup one estimated this. Check the numbers before saving.",
          );
        }
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
    setBackfillWhen(null);
    // The backup-model warning says "check the numbers before saving", so it
    // has to go once the meal IS saved — otherwise it sits there contradicting
    // itself over a log entry that is already written.
    setNotice(null);
    // A backfilled meal belongs to a past day, so jumping to Today would land on
    // a screen that doesn't show it. Stay in History, where it just appeared.
    setTab(entry.date === dateKey() ? "today" : "history");
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

  /**
   * Re-log a past meal to now, with no photo and no AI call. This is the whole
   * point of the recent list: the meals you repeat should cost one tap, and
   * should keep working when Gemini is down or the daily AI cap is spent.
   *
   * The copy drops the photo (source becomes "manual"): a photo belongs to the
   * plate you actually shot, and re-serving an old image as today's meal would
   * be quietly wrong. The macros, portion and item breakdown carry over.
   */
  function logAgain(src: FoodEntry) {
    const now = new Date();
    addEntry({
      id: newId(),
      timestamp: now.toISOString(),
      date: dateKey(now),
      name: src.name,
      portion: src.portion,
      calories: src.calories,
      protein_g: src.protein_g,
      carbs_g: src.carbs_g,
      fat_g: src.fat_g,
      items: src.items,
      note: src.note,
      source: "manual",
    });
    // addEntry clears the notice synchronously before its await, so setting it
    // afterwards wins. The new meal lands lower down under its sitting, which
    // can be below the fold, so this confirms the tap did something.
    setNotice(`Logged “${src.name}” again.`);
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

  // The distinct meals eaten most recently, newest first, deduped by name so a
  // meal logged every day shows once (carrying its most recent numbers). This
  // is the "log again" list — capped so it stays a quick glance, not a history.
  const recentMeals = useMemo(() => {
    const byRecency = [...entries].sort(
      (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
    );
    const seen = new Set<string>();
    const out: FoodEntry[] = [];
    for (const e of byRecency) {
      const key = e.name.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(e);
      if (out.length >= 8) break;
    }
    return out;
  }, [entries]);

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
      {notice && (
        <div className="v2-notice" onClick={() => setNotice(null)}>
          ☁️ {notice}
        </div>
      )}

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
              onClick={() => {
                setBackfillWhen(null);
                cameraRef.current?.click();
              }}
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
                onClick={() => {
                setBackfillWhen(null);
                cameraRef.current?.click();
              }}
                disabled={analyzing}
              >
                Take photo
              </button>
              <button
                className="v2-btn"
                onClick={() => {
                  setBackfillWhen(null);
                  libraryRef.current?.click();
                }}
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
              onClick={() => {
                setBackfillWhen(null);
                setShowManual(true);
              }}
              disabled={analyzing}
            >
              Add manually instead
            </button>
          </section>

          {/* One-tap re-log of meals you eat often. No photo, no AI call — so it
              is fast, spends no daily AI quota, and still works when Gemini is
              down. Hidden until there is any history to draw from. */}
          {recentMeals.length > 0 && (
            <div className="v2-recent">
              <div className="v2-section">
                <h2>Log again</h2>
                <span>tap to add to today</span>
              </div>
              <div className="v2-recent-row">
                {recentMeals.map((m) => (
                  <button
                    className="v2-recent-chip"
                    key={m.id}
                    onClick={() => logAgain(m)}
                    disabled={analyzing}
                  >
                    {m.hasPhoto ? (
                      <img
                        className="v2-thumb v2-recent-thumb"
                        src={`/api/photo/${encodeURIComponent(m.id)}?size=thumb`}
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="v2-thumb v2-recent-thumb"
                        style={{ "--tile-h": tileHue(m.name) } as React.CSSProperties}
                      >
                        {foodEmoji(m.name)}
                      </div>
                    )}
                    <div className="v2-recent-name">{m.name}</div>
                    <div className="v2-recent-kcal">{Math.round(m.calories)} kcal</div>
                  </button>
                ))}
              </div>
            </div>
          )}

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

          {/* The preview banner is gone: this IS the app now, so "your real
              log" and "the live app is unchanged at /" would both be false. */}
          {SHOW_PALETTE_SWITCHER && (
            <div className="v2-banner">
              Palette switcher above is development-only and is compiled out of
              production builds.
            </div>
          )}
        </>
      ) : tab === "history" ? (
        <HistoryView
          entries={entries}
          goals={goals}
          onOpen={setDetail}
          onDelete={deleteEntry}
          onAddPastMeal={() => {
            setBackfillWhen(defaultBackfillWhen());
            setShowBackfillChooser(true);
          }}
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

      {/* The hidden photo inputs live at the top level, NOT inside the Today
          tab, because History's "Add a past meal" chooser fires them too. When
          they were rendered only under tab === "today", cameraRef/libraryRef
          were null on the History tab and Take/Choose photo silently did
          nothing. capture="environment" opens the camera; the second input has
          no capture attribute so it opens the library. */}
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

      {analysis && (
        <AnalyzeSheet
          analysis={analysis}
          previewUrl={previewUrl}
          initialWhen={backfillWhen ?? undefined}
          onSave={addEntry}
          onClose={() => {
            setAnalysis(null);
            setPreviewUrl(undefined);
            setCaptured(null);
            setBackfillWhen(null);
            // Same reason as in addEntry: the warning is about the estimate on
            // screen, so it goes when that estimate does.
            setNotice(null);
          }}
        />
      )}

      {showManual && (
        <ManualEntryForm
          onSave={addEntry}
          initialWhen={backfillWhen ?? undefined}
          onClose={() => {
            setShowManual(false);
            setBackfillWhen(null);
          }}
        />
      )}

      {showBackfillChooser && (
        <BackfillChooser
          onClose={() => {
            setShowBackfillChooser(false);
            setBackfillWhen(null);
          }}
          onPhoto={() => {
            setShowBackfillChooser(false);
            cameraRef.current?.click();
          }}
          onLibrary={() => {
            setShowBackfillChooser(false);
            libraryRef.current?.click();
          }}
          onManual={() => {
            setShowBackfillChooser(false);
            setShowManual(true);
          }}
        />
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
