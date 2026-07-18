"use client";

import { useEffect, useMemo, useState } from "react";
import { FoodEntry, Goals, Analysis, DEFAULT_GOALS } from "@/lib/types";
import {
  loadEntries,
  saveEntries,
  loadGoals,
  saveGoals,
  loadPassword,
  savePassword,
  loadProfile,
  saveProfile,
} from "@/lib/storage";
import { apiHeaders } from "@/lib/api";
import {
  dateKey,
  friendlyDate,
  totalsForDate,
  dailySeries,
  averageOfLoggedDays,
  buildLogsSummary,
} from "@/lib/nutrition";
import {
  GOAL_OPTIONS,
  GoalDirection,
  isProfileComplete,
  suggestGoals,
} from "@/lib/goalsCalc";
import TabBar, { Tab } from "@/components/TabBar";
import MacroRings from "@/components/MacroRings";
import CameraCapture, { CapturedImage } from "@/components/CameraCapture";
import AnalyzeSheet from "@/components/AnalyzeSheet";
import ManualEntryForm from "@/components/ManualEntryForm";
import EntryCard from "@/components/EntryCard";
import TrendsChart from "@/components/TrendsChart";
import DayCard from "@/components/DayCard";
import CoachView from "@/components/CoachView";
import GoalAdvisor from "@/components/GoalAdvisor";

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
  const [showManual, setShowManual] = useState(false);

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

  function updateGoals(g: Goals) {
    setGoals(g);
    saveGoals(g);
  }

  async function handleCapture(img: CapturedImage) {
    setError(null);
    setPreviewUrl(img.dataUrl);
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

  const today = dateKey();
  const todayTotals = useMemo(() => totalsForDate(entries, today), [entries, today]);
  const todayEntries = useMemo(
    () => entries.filter((e) => e.date === today),
    [entries, today],
  );
  const logsSummary = useMemo(
    () => buildLogsSummary(entries, goals, 14),
    [entries, goals],
  );

  if (!mounted) {
    return (
      <div className="app">
        <div className="brand">
          <span className="dot" />
          Calorie Tracker
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
      <div className="brand">
        <span className="dot" />
        Calorie Tracker
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

        {tab === "history" && <HistoryView entries={entries} goals={goals} />}

        {tab === "coach" && (
          <CoachView logsSummary={logsSummary} hasData={entries.length > 0} />
        )}

        {tab === "settings" && <SettingsView goals={goals} onSave={updateGoals} />}
      </div>

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
      <div className="datebar">
        <span style={{ width: 32 }} />
        <div className="mid">
          <div className="day">Today</div>
          <div className="date">{totals.date}</div>
        </div>
        <span style={{ width: 32 }} />
      </div>

      <div className="card">
        <MacroRings totals={totals} goals={goals} />
      </div>

      {analyzing ? (
        <div className="card">
          <div className="loading-block">
            <span className="spinner" />
            <span>Analyzing your photo with Gemini…</span>
          </div>
        </div>
      ) : (
        <div className="logmeal">
          <CameraCapture onCapture={onCapture} onError={onError} />
          <button className="btn block alt" onClick={onManual}>
            Add manually
          </button>
        </div>
      )}

      <div className="section-head">
        <h2>Today&apos;s meals</h2>
        <span className="count">
          {entries.length} logged
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="empty">
          Nothing logged yet.
          <br />
          Snap a photo of your next meal to get started.
        </div>
      ) : (
        entries.map((e) => <EntryCard key={e.id} entry={e} onDelete={onDelete} />)
      )}
    </>
  );
}

// ---------- History ----------

function HistoryView({ entries, goals }: { entries: FoodEntry[]; goals: Goals }) {
  const [range, setRange] = useState<7 | 30>(7);
  const series = useMemo(() => dailySeries(entries, range), [entries, range]);
  const avg = useMemo(() => averageOfLoggedDays(series), [series]);
  const logged = series.filter((d) => d.count > 0);

  return (
    <>
      <p className="eyebrow">Patterns</p>
      <h1 className="page-title">History</h1>
      <p className="page-sub">
        {logged.length} day{logged.length === 1 ? "" : "s"} logged in the last {range}.
      </p>

      <div className="card">
        <div className="range-toggle">
          <button className={range === 7 ? "active" : ""} onClick={() => setRange(7)}>
            7 days
          </button>
          <button className={range === 30 ? "active" : ""} onClick={() => setRange(30)}>
            30 days
          </button>
        </div>
        <TrendsChart series={series} goalCalories={goals.calories} />
      </div>

      {logged.length > 0 && (
        <div className="card">
          <p className="label-sm">Average on logged days</p>
          <div className="stat-strong">{avg.calories} kcal</div>
          <div className="stat-sub">
            Protein {avg.protein_g}g · Carbs {avg.carbs_g}g · Fat {avg.fat_g}g per day
          </div>
        </div>
      )}

      <div className="section-head">
        <h2>Daily breakdown</h2>
      </div>

      {logged.length === 0 ? (
        <div className="empty">No days logged in this range yet.</div>
      ) : (
        [...logged]
          .reverse()
          .map((d) => <DayCard key={d.date} day={d} goals={goals} />)
      )}
    </>
  );
}

// ---------- Settings ----------

function SettingsView({
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

  const [pw, setPw] = useState("");
  const [pwSaved, setPwSaved] = useState(false);
  const [showAdvisor, setShowAdvisor] = useState(false);
  const [direction, setDirection] = useState<GoalDirection>("maintain");

  useEffect(() => {
    setPw(loadPassword());
    const p = loadProfile();
    if (p.goal) setDirection(p.goal);
  }, []);

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

  function applyGoals(g: Goals) {
    setCalories(String(g.calories));
    setProtein(String(g.protein_g));
    setCarbs(String(g.carbs_g));
    setFat(String(g.fat_g));
    onSave(g);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  /** Changing direction re-derives targets when we already know the profile. */
  function pickDirection(d: GoalDirection) {
    setDirection(d);
    const p = { ...loadProfile(), goal: d };
    saveProfile(p);
    if (isProfileComplete(p)) {
      const s = suggestGoals(p);
      applyGoals({
        calories: s.calories,
        protein_g: s.protein_g,
        carbs_g: s.carbs_g,
        fat_g: s.fat_g,
      });
    }
  }

  const rows: [string, string, string, (v: string) => void][] = [
    ["Calories", calories, "kcal", setCalories],
    ["Protein", protein, "g", setProtein],
    ["Carbs", carbs, "g", setCarbs],
    ["Fat", fat, "g", setFat],
  ];

  return (
    <>
      <p className="eyebrow">Targets</p>
      <h1 className="page-title">Settings</h1>

      <div className="card">
        <p className="card-title">Daily targets</p>
        {rows.map(([name, value, unit, setter]) => (
          <div className="target-row" key={name}>
            <span className="tname">{name}</span>
            <span className="tinput">
              <input
                type="number"
                inputMode="numeric"
                value={value}
                onChange={(e) => setter(e.target.value)}
                aria-label={name}
              />
              <span className="unit">{unit}</span>
            </span>
          </div>
        ))}
        <button
          className="btn block"
          style={{ marginTop: 14 }}
          onClick={() => setShowAdvisor(true)}
        >
          ✨ Suggest goals for me
        </button>
      </div>

      <div className="card">
        <p className="card-title">Goal</p>
        <div className="goalseg">
          {GOAL_OPTIONS.map((g) => (
            <button
              key={g.value}
              className={direction === g.value ? "active" : ""}
              onClick={() => pickDirection(g.value)}
            >
              <span className="gt">{GOAL_LABELS[g.value]}</span>
              <span className="gs">{GOAL_SUBS[g.value]}</span>
            </button>
          ))}
        </div>
      </div>

      <button className="btn primary block" onClick={handleSave}>
        {saved ? "✓ Saved" : "Save changes"}
      </button>

      <div className="card" style={{ marginTop: 18 }}>
        <p className="card-title">Access password</p>
        <p className="assumptions" style={{ marginTop: -6 }}>
          Only needed if this app is deployed with an <code>APP_PASSWORD</code> set.
          Leave blank for local use.
        </p>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="(none)"
            autoComplete="off"
          />
        </div>
        <button
          className="btn block"
          onClick={() => {
            savePassword(pw.trim());
            setPwSaved(true);
            setTimeout(() => setPwSaved(false), 1800);
          }}
        >
          {pwSaved ? "✓ Saved" : "Save password"}
        </button>
      </div>

      <p className="disclaimer">
        AI estimates are approximate. Not medical advice.
      </p>

      {showAdvisor && (
        <GoalAdvisor onApply={applyGoals} onClose={() => setShowAdvisor(false)} />
      )}
    </>
  );
}

const GOAL_LABELS: Record<GoalDirection, string> = {
  lose: "Cut",
  maintain: "Maintain",
  gain: "Bulk",
};
const GOAL_SUBS: Record<GoalDirection, string> = {
  lose: "Steady deficit",
  maintain: "Hold steady",
  gain: "Gentle surplus",
};
