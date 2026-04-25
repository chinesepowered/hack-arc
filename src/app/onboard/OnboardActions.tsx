"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function OnboardActions() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/wallet/provision", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "provisioning failed");
      setResult(
        `Wallet ready: ${data.walletAddress}. Signing you out so the session picks up the new wallet — sign back in.`
      );
      setTimeout(() => signOut({ redirectTo: "/auth/sign-in" }), 1500);
    } catch (err) {
      setResult(err instanceof Error ? err.message : "unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-3">
      <Button onClick={retry} disabled={busy} size="lg">
        {busy ? "Retrying…" : "Retry wallet creation"}
      </Button>
      {result && (
        <p className="rounded border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-slate-200">
          {result}
        </p>
      )}
    </div>
  );
}
