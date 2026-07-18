"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";

interface AccountStatus {
  accounts: boolean;
  signedIn?: boolean;
  user?: { email: string | null; name: string | null };
}

/** Shows who you're signed in as, with a sign-out button. */
export default function AccountCard() {
  const [status, setStatus] = useState<AccountStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setStatus(d);
      })
      .catch(() => {
        if (!cancelled) setStatus({ accounts: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing to show when accounts aren't enabled (local single-user mode).
  if (!status || !status.accounts || !status.signedIn) return null;

  return (
    <div className="card">
      <p className="card-title">Account</p>
      <p className="assumptions" style={{ marginTop: -6 }}>
        Signed in as <strong>{status.user?.email}</strong>. Your log is private to
        this account and syncs across your devices.
      </p>
      <button className="btn block" onClick={() => signOut({ callbackUrl: "/" })}>
        Sign out
      </button>
    </div>
  );
}
