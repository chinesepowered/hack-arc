"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { shortAddress, formatUsdc, timeAgo, cn } from "@/lib/utils";

type Stamp = {
  id: string;
  onchainId: string | null;
  senderAddress: string;
  recipientAddress: string;
  subject: string;
  body: string;
  stakeWei: string;
  status:
    | "submitting"
    | "pending"
    | "refunded"
    | "forfeited"
    | "expired"
    | "failed";
  sendTxHash: string | null;
  resolveTxHash: string | null;
  aiTriageLabel: "legit" | "spam" | "unsure" | null;
  aiTriageReason: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

const EXPLORER = "https://testnet.arcscan.app";

export function InboxView({ folder }: { folder: "inbox" | "sent" }) {
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/stamps?folder=${folder}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data: { stamps: Stamp[] } = await res.json();
      setStamps(data.stamps);
    }
  }, [folder]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const pending = useMemo(
    () => stamps.filter((s) => s.status === "pending"),
    [stamps]
  );
  const selectedPending = useMemo(
    () => pending.filter((s) => selected.has(s.id)),
    [pending, selected]
  );

  const stats = useMemo(() => {
    const totalStaked = stamps.reduce((acc, s) => acc + BigInt(s.stakeWei), 0n);
    const pendingCount = pending.length;
    const forfeited = stamps
      .filter((s) => s.status === "forfeited")
      .reduce((acc, s) => acc + BigInt(s.stakeWei), 0n);
    return { totalStaked, pendingCount, forfeited };
  }, [stamps, pending]);

  async function triage(action: "refund" | "forfeit") {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch("/api/stamps/triage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stampIds: ids, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "triage failed");
      setBanner(
        `${action === "refund" ? "Refunded" : "Forfeited"} ${data.count ?? ids.length} stamp(s). ${
          data.txHash ? `Tx: ${data.txHash}` : ""
        }`
      );
      setSelected(new Set());
      load();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "triage failed");
    } finally {
      setBusy(false);
    }
  }

  async function suggest() {
    const ids = pending.map((s) => s.id);
    if (!ids.length) return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch("/api/stamps/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stampIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "suggest failed");
      setBanner(`AI triage done: ${data.suggestions?.length ?? 0} messages classified`);
      load();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "suggest failed");
    } finally {
      setBusy(false);
    }
  }

  function selectByAi(label: "legit" | "spam") {
    const ids = pending.filter((s) => s.aiTriageLabel === label).map((s) => s.id);
    setSelected(new Set(ids));
  }

  function toggleAll() {
    setSelected(
      selected.size === pending.length
        ? new Set()
        : new Set(pending.map((s) => s.id))
    );
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  const active = activeId ? stamps.find((s) => s.id === activeId) : null;

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Pending" value={stats.pendingCount.toString()} />
        <Stat
          label="Total staked"
          value={`$${formatUsdc(stats.totalStaked)} USDC`}
        />
        <Stat
          label={folder === "inbox" ? "Earned from spam" : "Forfeited (you)"}
          value={`$${formatUsdc(stats.forfeited)} USDC`}
        />
      </div>

      {folder === "inbox" && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-900 bg-slate-900/30 px-3 py-2">
          <Button size="sm" variant="ghost" onClick={toggleAll}>
            {selected.size === pending.length && pending.length > 0
              ? "Clear"
              : "Select all pending"}
          </Button>
          <Button size="sm" variant="ghost" onClick={suggest} disabled={busy || !pending.length}>
            AI triage
          </Button>
          <Button size="sm" variant="ghost" onClick={() => selectByAi("legit")}>
            Select AI-legit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => selectByAi("spam")}>
            Select AI-spam
          </Button>
          <div className="flex-1" />
          <span className="text-xs text-slate-500">
            {selected.size} selected
          </span>
          <Button
            size="sm"
            variant="success"
            onClick={() => triage("refund")}
            disabled={busy || !selectedPending.length}
          >
            Refund
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => triage("forfeit")}
            disabled={busy || !selectedPending.length}
          >
            Forfeit
          </Button>
        </div>
      )}

      {banner && (
        <div className="rounded-md border border-indigo-900 bg-indigo-950/40 px-3 py-2 text-xs text-indigo-200">
          {banner}
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-3">
        <ul className="w-1/2 overflow-y-auto rounded-md border border-slate-900">
          {stamps.length === 0 && (
            <li className="p-6 text-center text-sm text-slate-500">
              {folder === "inbox"
                ? "No stamps yet. Share your handle — senders will need to stake USDC to reach you."
                : "You haven't sent any stamps."}
            </li>
          )}
          {stamps.map((s) => (
            <li
              key={s.id}
              className={cn(
                "cursor-pointer border-b border-slate-900 px-3 py-2.5 text-sm hover:bg-slate-900/50",
                activeId === s.id && "bg-slate-900",
                selected.has(s.id) && "border-l-2 border-l-indigo-500"
              )}
              onClick={() => setActiveId(s.id)}
            >
              <div className="flex items-center gap-2">
                {folder === "inbox" && s.status === "pending" && (
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggle(s.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 accent-indigo-500"
                  />
                )}
                <span className="font-mono text-xs text-slate-500">
                  {shortAddress(
                    folder === "inbox" ? s.senderAddress : s.recipientAddress
                  )}
                </span>
                <span className="ml-auto text-xs text-emerald-400">
                  ${formatUsdc(s.stakeWei)}
                </span>
              </div>
              <p className="mt-1 truncate font-medium">{s.subject}</p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                <StatusPill status={s.status} />
                {s.aiTriageLabel && <AiPill label={s.aiTriageLabel} />}
                <span className="ml-auto">{timeAgo(s.createdAt)}</span>
              </p>
            </li>
          ))}
        </ul>

        <div className="flex w-1/2 min-h-0 flex-col rounded-md border border-slate-900">
          {active ? (
            <ActiveStamp stamp={active} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              Select a message to view
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-900 px-3 py-2">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: Stamp["status"] }) {
  const color: Record<Stamp["status"], string> = {
    submitting: "bg-slate-800 text-slate-300",
    pending: "bg-amber-950 text-amber-300",
    refunded: "bg-emerald-950 text-emerald-300",
    forfeited: "bg-rose-950 text-rose-300",
    expired: "bg-slate-800 text-slate-300",
    failed: "bg-rose-950 text-rose-300",
  };
  return (
    <span className={cn("rounded-sm px-1.5 py-0.5 text-[10px] uppercase", color[status])}>
      {status}
    </span>
  );
}

function AiPill({ label }: { label: "legit" | "spam" | "unsure" }) {
  const color =
    label === "legit"
      ? "bg-emerald-950/70 text-emerald-300"
      : label === "spam"
        ? "bg-rose-950/70 text-rose-300"
        : "bg-slate-800 text-slate-300";
  return (
    <span className={cn("rounded-sm px-1.5 py-0.5 text-[10px]", color)}>
      AI: {label}
    </span>
  );
}

function ActiveStamp({ stamp }: { stamp: Stamp }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-5">
      <h2 className="text-lg font-semibold">{stamp.subject}</h2>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        <span className="font-mono">
          {shortAddress(stamp.senderAddress, 6)} →{" "}
          {shortAddress(stamp.recipientAddress, 6)}
        </span>
        <StatusPill status={stamp.status} />
        <span className="ml-auto text-emerald-400">
          ${formatUsdc(stamp.stakeWei)} staked
        </span>
      </div>
      {stamp.aiTriageLabel && (
        <div className="mt-3 rounded-md border border-slate-900 bg-slate-900/40 px-3 py-2 text-xs">
          <p className="text-slate-400">
            AI says: <AiPill label={stamp.aiTriageLabel} />
          </p>
          {stamp.aiTriageReason && (
            <p className="mt-1 text-slate-300">{stamp.aiTriageReason}</p>
          )}
        </div>
      )}
      <p className="mt-4 whitespace-pre-wrap text-sm text-slate-200">
        {stamp.body}
      </p>
      <div className="mt-auto space-y-1 border-t border-slate-900 pt-3 text-xs text-slate-500">
        {stamp.sendTxHash && (
          <a
            href={`${EXPLORER}/tx/${stamp.sendTxHash}`}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-indigo-400 hover:underline"
          >
            send tx ↗ {stamp.sendTxHash}
          </a>
        )}
        {stamp.resolveTxHash && (
          <a
            href={`${EXPLORER}/tx/${stamp.resolveTxHash}`}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-indigo-400 hover:underline"
          >
            resolve tx ↗ {stamp.resolveTxHash}
          </a>
        )}
        {stamp.onchainId && (
          <p>
            onchain id: <span className="font-mono text-slate-400">{stamp.onchainId}</span>
          </p>
        )}
      </div>
    </div>
  );
}
