import { AppHeader } from "@/components/app-header";
import { InboxView } from "./InboxView";

export const dynamic = "force-dynamic";

export default function InboxPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-6">
        <InboxView folder="inbox" />
      </main>
    </>
  );
}
