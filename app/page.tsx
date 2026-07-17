"use client";

import { useEffect, useMemo, useState } from "react";
import { FoodEntry, Goals, Analysis, DEFAULT_GOALS } from "@/lib/types";
import { loadEntries, saveEntries, loadGoals, saveGoals } from "@/lib/storage";
import {
  dateKey,
  friendlyDate,
  totalsForDate,
  dailySeries,
  averageOfLoggedDays,
  buildLogsSummary,
} from "@/lib/nutrition";
import TabBar, { Tab } from "@/components/TabBar";
import DayRing from "@/components/DayRing";
import CameraCapture, { CapturedImage } from "@/components/CameraCapture";
import AnalyzeSheet from "@/components/AnalyzeSheet";
import ManualEntryForm from "@/components/ManualEntryForm";
import EntryCard from "@/components/EntryCard";
import TrendsChart from "@/components/TrendsChart";
import AdviceSheet from "@/components/AdviceSheet";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>("today");
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);

  // photo flow
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  // sheets
  const [showManual, setShowManual] = useState(false);
  const [showAdvice, setShowAdvice] = useState(false);

  // hydrate from localStorage on mount
  useEffect(() => {
    setEntries(loadEntries());
    setGoals(loadGoals());
    setMounted(true);
  }, []);

  function persistEntries(next: FoodEntry[]) {
    setEntries(next);
    saveEntries(next);
  }

  function addEntry(entry: FoodEntry) {
    persistEntries([entry, ...entries]);
    setAnalysis(null);
    setPreviewUrl(undefined);
    setShowManual(false);
    setTab("today");
  }

  function deleteEntry(id: string) {
    persistEntries(entries.filter((e) => e.id !== id));
  }

  async function handleCapture(img: CapturedImage) {
    setError(null);
    setPreviewUrl(img.dataUrl);
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const today = dateKey();
  const todayTotals = useMemo(
    () => totalsForDate(entries, today),
    [entries, today],
  );
  const todayEntries = useMemo(
    () => entries.filter((e) => e.date === today),
    [entries, today],
  );

  const logsSummary = useMemo(
    () => buildLogsSummary(entries, goals, 14),
    [entries, goals],
  );

  // Avoid hydration mismatch: render nothing data-dependent until mounted.
  if (!mounted) {
    return (
      <div className="app">
        <div className="header">
          <div>
            <h1>🥗 Calorie Tracker</h1>
          </div>
        </div>
        <div className="content">
          <div className="loading-block">
            <span className="spinner" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <div>
          <h1>🥗 Calorie Tracker</h1>
          <div className="sub">{friendlyDate(today)}</div>
        </div>
        <button
          className="btn"
          style={{ padding: "10px 14px" }}
          onClick={() => setShowAdvice(true)}
        >
          💡 Advice
        </button>
      </div>

      <div className="content">
        {error && <div className="error-note">{error}</div>}

        {tab === "today" && (
          <TodayView
            totals={todayTotals}
            goals={goals}
            entries={todayEntries}
            analyzing={analyzing}
            onCapture={handleCapture}
            onError={setError}
            onManual={() => setShowManual(true)}
            onDelete={deleteEntry}
          />
        )}

        {tab === "trends" && <TrendsView entries={entries} goals={goals} />}

        {tab === "goals" && (
          <GoalsView
            goals={goals}
            onSave={(g) => {
              setGoals(g);
              saveGoals(g);
            }}
          />
        )}
      </div>

      <p className="disclaimer">
        AI estimates are approximate. Adjust portions you know better. Not medical
        advice.
      </p>

      <TabBar active={tab} onChange={setTab} />

      {analysis && (
        <AnalyzeSheet
          analysis={analysis}
          previewUrl={previewUrl}
          onSave={addEntry}
          onClose={() => {
            setAnalysis(null);
            setPreviewUrl(undefined);
          }}
        />
      )}

      {showManual && (
        <ManualEntryForm onSave={addEntry} onClose={() => setShowManual(false)} />
      )}

      {showAdvice && (
        <AdviceSheet
          logsSummary={logsSummary}
          hasData={entries.length > 0}
          onClose={() => setShowAdvice(false)}
        />
      )}
    </div>
  );
}

// ---------- Today ----------

function TodayView({
  totals,
  goals,
  entries,
  analyzing,
  onCapture,
  onError,
  onManual,
  onDelete,
}: {
  totals: ReturnType<typeof totalsForDate>;
  goals: Goals;
  entries: FoodEntry[];
  analyzing: boolean;
  onCapture: (img: CapturedImage) => void;
  onError: (m: string) => void;
  onManual: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <div className="card">
        <DayRing totals={totals} goals={goals} />
      </div>

      <div className="card">
        <p className="card-title">Add food</p>
        {analyzing ? (
          <div className="loading-block">
            <span className="spinner" />
            <span>Analyzing your photo with Gemini…</span>
          </div>
        ) : (
          <>
            <CameraCapture onCapture={onCapture} onError={onError} />
            <button className="btn block" style={{ marginTop: 10 }} onClick={onManual}>
              ⌨️ Add manually
            </button>
          </>
        )}
      </div>

      <div className="card">
        <p className="card-title">Today&apos;s log</p>
        {entries.length === 0 ? (
          <div className="empty">
            Nothing logged yet.
            <br />
            Snap a photo of your next meal to get started.
          </div>
        ) : (
          entries.map((e) => (
            <EntryCard key={e.id} entry={e} onDelete={onDelete} />
          ))
        )}
      </div>
    </>
  );
}

// ---------- Trends ----------

function TrendsView({ entries, goals }: { entries: FoodEntry[]; goals: Goals }) {
  const [range, setRange] = useState<7 | 30>(7);
  const series = useMemo(() => dailySeries(entries, range), [entries, range]);
  const avg = useMemo(() => averageOfLoggedDays(series), [series]);
  const loggedDays = series.filter((d) => d.count > 0).length;

  return (
    <>
      <div className="card">
        <div className="range-toggle">
          <button
            className={range === 7 ? "active" : ""}
            onClick={() => setRange(7)}
          >
            7 days
          </button>
          <button
            className={range === 30 ? "active" : ""}
            onClick={() => setRange(30)}
          >
            30 days
          </button>
        </div>
        <TrendsChart series={series} goalCalories={goals.calories} />
      </div>

      <div className="card">
        <p className="card-title">Average on logged days ({loggedDays})</p>
        {loggedDays === 0 ? (
          <div className="empty">No data yet for this range.</div>
        ) : (
          <>
            <div className="stat-strong">{avg.calories} kcal</div>
            <div className="stat-sub">
              Protein {avg.protein_g}g · Carbs {avg.carbs_g}g · Fat {avg.fat_g}g per day
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ---------- Goals ----------

function GoalsView({
  goals,
  onSave,
}: {
  goals: Goals;
  onSave: (g: Goals) => void;
}) {
  const [calories, setCalories] = useState(String(goals.calories));
  const [protein, setProtein] = useState(String(goals.protein_g));
  const [carbs, setCarbs] = useState(String(goals.carbs_g));
  const [fat, setFat] = useState(String(goals.fat_g));
  const [saved, setSaved] = useState(false);

  const num = (s: string) => {
    const n = parseFloat(s);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  };

  function handleSave() {
    onSave({
      calories: num(calories),
      protein_g: num(protein),
      carbs_g: num(carbs),
      fat_g: num(fat),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="card">
      <p className="card-title">Daily targets</p>
      <div className="field">
        <label>Calories (kcal)</label>
        <input
          type="number"
          inputMode="numeric"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
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
          />
        </div>
        <div className="field">
          <label>Carbs (g)</label>
          <input
            type="number"
            inputMode="numeric"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Fat (g)</label>
          <input
            type="number"
            inputMode="numeric"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
          />
        </div>
      </div>
      <button className="btn primary block" onClick={handleSave}>
        {saved ? "✓ Saved" : "Save goals"}
      </button>
    </div>
  );
}
