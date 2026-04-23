import { AppHeader } from "@/components/app-header";
import { ComposeForm } from "./ComposeForm";

export default function ComposePage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold">Compose stamped message</h1>
        <p className="mt-1 text-sm text-slate-400">
          Your stake locks on Arc. If the recipient marks your message as legit, you
          get it all back. If it&rsquo;s spam, you forfeit the stake (minus
          protocol fee) to the recipient.
        </p>
        <ComposeForm />
      </main>
    </>
  );
}
