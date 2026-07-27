"use client";

import { useState } from "react";

/**
 * The text path into AI estimation: type what you ate and Gemini fills in the
 * macros, without a photo. It sits beside the camera as an *AI* input (the
 * result still flows through the same review sheet), which is why it lives on
 * the capture card rather than next to the no-AI manual form.
 *
 * `busy` is the shared analyzing flag: while an estimate is in flight the sheet
 * stays open, disabled, showing progress, so a slow call can't be fired twice.
 */
export default function DescribeSheet({
  onEstimate,
  onClose,
  busy,
}: {
  onEstimate: (text: string) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const [text, setText] = useState("");
  const canSubmit = text.trim().length > 0 && !busy;

  return (
    <div className="sheet-backdrop" onClick={busy ? undefined : onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-scroll">
          <h2>Describe your meal</h2>
          <p className="assumptions">
            Type what you ate and the AI estimates the calories and macros — no
            photo needed.
          </p>

          <div className="field">
            <label>Meal</label>
            <textarea
              className="describe-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. a bowl of wonton noodle soup and a glass of soy milk"
              rows={4}
              maxLength={500}
              autoFocus
              disabled={busy}
            />
          </div>
          <p className="assumptions">
            The more detail — portion size, cooking method — the closer the
            estimate. You can adjust the numbers before saving.
          </p>
        </div>

        <div className="sheet-footer">
          <div className="fab-row">
            <button className="btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={!canSubmit}
              onClick={() => onEstimate(text.trim())}
            >
              {busy ? "Estimating…" : "Estimate with AI"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
