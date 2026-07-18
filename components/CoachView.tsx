"use client";

import { useState } from "react";
import { markdownToHtml } from "@/lib/markdown";
import { apiHeaders } from "@/lib/api";

/** Coach tab: fetches a personalized read of the last ~14 days of logs. */
export default function CoachView({
  logsSummary,
  hasData,
}: {
  logsSummary: string;
  hasData: boolean;
}) {
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function getAdvice() {
    setLoading(true);
    setError(null);
    setAdvice(null);
    try {
      const res = await fetch("/api/advice", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ logsSummary }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Could not get advice.");
      else setAdvice(data.advice);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <p className="eyebrow">Coach</p>
      <h1 className="page-title">Ask for a read</h1>
      <p className="page-sub">
        Gemini reviews your last 14 days and offers specific, actionable notes. Not
        medical advice.
      </p>

      <div className="card">
        {!hasData ? (
          <div className="empty">
            Log a few meals first — the read gets much more useful once there&apos;s
            data to look at.
          </div>
        ) : (
          <>
            {!advice && !loading && (
              <p className="assumptions" style={{ margin: "0 0 14px" }}>
                We&apos;ll look at your daily calories and macros against your targets,
                then suggest what to adjust.
              </p>
            )}

            {loading && (
              <div className="loading-block">
                <span className="spinner" />
                <span>Reviewing your recent logs…</span>
              </div>
            )}

            {error && <div className="error-note">{error}</div>}

            {advice && (
              <div
                className="advice-body"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(advice) }}
              />
            )}

            <button
              className="btn primary block"
              style={{ marginTop: advice ? 16 : 0 }}
              onClick={getAdvice}
              disabled={loading}
            >
              {loading ? "Thinking…" : advice ? "Get another read" : "Get advice"}
            </button>
          </>
        )}
      </div>

      <p className="disclaimer">
        General wellness guidance based on approximate AI estimates — not medical
        advice.
      </p>
    </>
  );
}
