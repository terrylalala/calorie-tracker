"use client";

import { useEffect, useState } from "react";
import { markdownToHtml } from "@/lib/markdown";

/** Sheet that fetches and renders personalized advice from /api/advice. */
export default function AdviceSheet({
  logsSummary,
  hasData,
  onClose,
}: {
  logsSummary: string;
  hasData: boolean;
  onClose: () => void;
}) {
  const [advice, setAdvice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasData) return;
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/advice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logsSummary }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Could not get advice.");
        } else {
          setAdvice(data.advice);
        }
      } catch {
        if (!cancelled) setError("Network error. Please check your connection.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [logsSummary, hasData]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-scroll">
        <h2>💡 Personalized advice</h2>

        {!hasData && (
          <p className="assumptions">
            Log a few meals first — advice gets more useful once there&apos;s data to
            look at.
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

        <p className="disclaimer" style={{ marginTop: 16 }}>
          General wellness guidance based on approximate AI estimates — not medical
          advice.
        </p>
        </div>
        <div className="sheet-footer">
          <button className="btn block" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
