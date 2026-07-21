"use client";

import { useEffect, useMemo, useState } from "react";
import { FoodEntry, Goals, Analysis, DEFAULT_GOALS } from "@/lib/types";
import { loadProfile } from "@/lib/storage";
import AuthGate from "@/components/AuthGate";
import { apiHeaders } from "@/lib/api";
import {
  StorageMode,
  detectMode,
  loadAll,
  addEntry as storeAddEntry,
  removeEntry as storeRemoveEntry,
  putSettings,
} from "@/lib/dataStore";
import {
  dateKey,
  friendlyDate,
  totalsForDate,
  buildLogsSummary,
} from "@/lib/nutrition";
import TabBar, { Tab } from "@/components/TabBar";
import MacroRings from "@/components/MacroRings";
import CameraCapture, { CapturedImage } from "@/components/CameraCapture";
import AnalyzeSheet from "@/components/AnalyzeSheet";
import ManualEntryForm from "@/components/ManualEntryForm";
import EntryCard from "@/components/EntryCard";
import CoachView from "@/components/CoachView";
import MealDetailSheet from "@/components/MealDetailSheet";
// Extracted so /v2 can render the same views under a different skin, rather
// than growing a second copy that has to be kept in sync.
import HistoryView from "@/components/HistoryView";
import SettingsView from "@/components/SettingsView";

export default function Page() {
  return (
    <AuthGate>
      <TrackerApp />
    </AuthGate>
  );
}

function TrackerApp() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>("today");
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);

  // photo flow
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [captured, setCaptured] = useState<CapturedImage | null>(null);
  const [detail, setDetail] = useState<FoodEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [mode, setMode] = useState<StorageMode>("local");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const detected = await detectMode();
      const data = await loadAll(detected);
      if (cancelled) return;
      setMode(data.mode);
      setEntries(data.entries);
      setGoals(data.goals);
      if (data.error) setError(data.error);
      if (data.migrated) {
        setNotice(
          `Synced ${data.migrated} existing ${data.migrated === 1 ? "entry" : "entries"} to your database.`,
        );
      }
      setMounted(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  async function handleCapture(img: CapturedImage) {
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
          AI Cal Boy
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
        AI Cal Boy
      </div>

      <div className="content">
        {error && <div className="error-note">{error}</div>}
        {notice && (
          <div className="notice" onClick={() => setNotice(null)}>
            ☁️ {notice}
          </div>
        )}

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
            onOpen={setDetail}
          />
        )}

        {tab === "history" && (
          <HistoryView
            entries={entries}
            goals={goals}
            onOpen={setDetail}
            onDelete={deleteEntry}
          />
        )}

        {tab === "coach" && (
          <CoachView logsSummary={logsSummary} hasData={entries.length > 0} />
        )}

        {tab === "settings" && (
          <SettingsView goals={goals} onSave={updateGoals} mode={mode} />
        )}
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
  onOpen,
}: {
  totals: ReturnType<typeof totalsForDate>;
  goals: Goals;
  entries: FoodEntry[];
  analyzing: boolean;
  onCapture: (img: CapturedImage) => void;
  onError: (m: string) => void;
  onManual: () => void;
  onDelete: (id: string) => void;
  onOpen: (e: FoodEntry) => void;
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
        entries.map((e) => (
          <EntryCard key={e.id} entry={e} onDelete={onDelete} onOpen={onOpen} />
        ))
      )}
    </>
  );
}
