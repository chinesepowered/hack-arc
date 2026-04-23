"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function DemoPanel() {
  const [targetHandle, setTargetHandle] = useState("");
  const [count, setCount] = useState(15);
  const [stake, setStake] = useState("0.10");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  async function fire() {
    setBusy(true);
    setLog((l) => [
      ...l,
      `→ firing ${count} stamps at @${targetHandle} ($${stake} each)…`,
    ]);
    try {
      const res = await fetch("/api/demo/spam-wave", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fromHandle: targetHandle, // handle that receives the wave
          count,
          stakeUsdc: stake,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "spam-wave failed");
      setLog((l) => [
        ...l,
        `✔ ${data.sent} sent, ${data.failed} failed (${data.sent * 2} tx on Arc)`,
      ]);
    } catch (err) {
      setLog((l) => [
        ...l,
        `✘ ${err instanceof Error ? err.message : "unknown"}`,
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="rounded-md border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
        Run this while signed in as the <em>spammer</em> account. Stamps will be
        sent to the target handle&rsquo;s inbox.
      </div>
      <div>
        <label className="text-xs uppercase tracking-wider text-slate-500">
          Target handle (receives spam)
        </label>
        <Input
          value={targetHandle}
          onChange={(e) => setTargetHandle(e.target.value)}
          placeholder="founder"
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs uppercase tracking-wider text-slate-500">
            How many
          </label>
          <Input
            type="number"
            min={1}
            max={30}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </div>
        <div className="flex-1">
          <label className="text-xs uppercase tracking-wider text-slate-500">
            Stake each ($)
          </label>
          <Input
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            pattern="^\d+(\.\d{1,6})?$"
          />
        </div>
      </div>
      <Button size="lg" disabled={busy || !targetHandle} onClick={fire}>
        {busy ? "Firing…" : `Fire ${count} stamps`}
      </Button>
      <div className="max-h-72 overflow-y-auto rounded-md border border-slate-900 bg-slate-950/80 p-3 font-mono text-xs">
        {log.length === 0 ? (
          <p className="text-slate-600">Output will appear here.</p>
        ) : (
          log.map((line, i) => (
            <p
              key={i}
              className={
                line.startsWith("✔")
                  ? "text-emerald-400"
                  : line.startsWith("✘")
                    ? "text-rose-400"
                    : "text-slate-300"
              }
            >
              {line}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
