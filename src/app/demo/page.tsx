import { AppHeader } from "@/components/app-header";
import { DemoPanel } from "./DemoPanel";

export default function DemoPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold">Demo control panel</h1>
        <p className="mt-1 text-sm text-slate-400">
          Simulate a spam wave to populate an inbox with stamped messages. Each
          stamp produces 2 onchain transactions (approve + sendStamp), then
          bulk-triage adds 1 more. 25 messages ≈ 75 confirmed tx on Arc.
        </p>
        <DemoPanel />
      </main>
    </>
  );
}
