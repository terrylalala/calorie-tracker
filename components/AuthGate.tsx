"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn } from "next-auth/react";

interface AccountStatus {
  accounts: boolean;
  signedIn?: boolean;
  registered?: boolean;
  inviteRequired?: boolean;
  user?: { email: string | null; name: string | null };
}

/**
 * Wraps the app. Renders children only once the visitor is allowed in:
 *
 *  - no database        → accounts disabled, render straight through
 *  - not signed in      → Google sign-in screen
 *  - signed in, no acct → invite-code screen
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/account");
      setStatus(await res.json());
    } catch {
      // If we can't reach the server, assume local mode rather than locking out.
      setStatus({ accounts: false });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function register() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not complete sign-up.");
      } else {
        await refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Still checking.
  if (!status) {
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

  // Accounts disabled (no database) — single-user local mode.
  if (!status.accounts) return <>{children}</>;

  // Signed in and registered — let them through.
  if (status.signedIn && status.registered) return <>{children}</>;

  return (
    <div className="app">
      <div className="brand">
        <span className="dot" />
        Calorie Tracker
      </div>

      <div className="content">
        {!status.signedIn ? (
          <>
            <p className="eyebrow">Welcome</p>
            <h1 className="page-title">Track what you eat</h1>
            <p className="page-sub">
              Snap a photo of your meal and get calories and macros estimated for
              you. Sign in to keep your log in sync across devices.
            </p>
            <div className="card">
              <button
                className="btn primary block"
                onClick={() => signIn("google")}
              >
                Continue with Google
              </button>
              <p className="assumptions" style={{ marginBottom: 0, marginTop: 14 }}>
                We only use your Google account to identify you — nothing is posted
                or read from it.
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="eyebrow">Almost there</p>
            <h1 className="page-title">Enter your invite code</h1>
            <p className="page-sub">
              Signed in as {status.user?.email}. This app is invite-only — enter the
              code you were given to finish setting up your account.
            </p>

            <div className="card">
              {error && <div className="error-note">{error}</div>}
              <div className="field">
                <label>Invite code</label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. sunny-walnut-84"
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && code.trim()) register();
                  }}
                />
              </div>
              <button
                className="btn primary block"
                disabled={!code.trim() || submitting}
                onClick={register}
              >
                {submitting ? "Checking…" : "Create my account"}
              </button>
            </div>

            <p className="disclaimer">
              Wrong account?{" "}
              <button
                className="linklike"
                onClick={() => signIn("google", { prompt: "select_account" })}
              >
                Switch Google account
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
