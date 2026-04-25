"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const PRESETS = ["0.10", "0.25", "0.50", "1.00"];

export function ComposeForm() {
  const router = useRouter();
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [stake, setStake] = useState("0.25");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/stamps/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipientHandle: recipient,
          subject,
          body,
          stakeUsdc: stake,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "send failed");
      setSuccess(`Sent. Tx: ${data.txHash}`);
      setRecipient("");
      setSubject("");
      setBody("");
      setTimeout(() => router.push("/sent"), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <div>
        <label className="text-xs uppercase tracking-wider text-slate-500">
          Recipient handle
        </label>
        <Input
          required
          placeholder="founder"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
      </div>
      <div>
        <label className="text-xs uppercase tracking-wider text-slate-500">
          Subject
        </label>
        <Input
          required
          placeholder="Pitch: AI sales agent for dental clinics"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>
      <div>
        <label className="text-xs uppercase tracking-wider text-slate-500">
          Message
        </label>
        <Textarea
          required
          rows={8}
          placeholder="Keep it short and relevant. If the recipient decides it's legit, you get the full stake back."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      <div>
        <label className="text-xs uppercase tracking-wider text-slate-500">
          Stake (USDC)
        </label>
        <div className="mt-1 flex items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setStake(p)}
              className={`rounded-md border px-2.5 py-1 text-xs ${
                stake === p
                  ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                  : "border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              ${p}
            </button>
          ))}
          <Input
            className="w-28"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            pattern="^\d+(\.\d{1,6})?$"
          />
        </div>
      </div>
      {error && (
        <p className="rounded border border-rose-900 bg-rose-950/50 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded border border-emerald-900 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-300">
          {success}
        </p>
      )}
      <Button size="lg" disabled={busy}>
        {busy ? "Staking + sending…" : `Stake $${stake} and send`}
      </Button>
      <p className="text-xs text-slate-500">
        2 onchain transactions will fire: (1) USDC approve to escrow, (2)
        sendStamp. Sub-cent gas paid in USDC on Arc.
      </p>
    </form>
  );
}
