import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function Landing() {
  const session = await auth();
  if (session?.user) redirect("/inbox");

  return (
    <main className="mx-auto max-w-3xl px-6 py-20 text-slate-100">
      <p className="text-xs uppercase tracking-widest text-indigo-400">
        Arc · USDC · Nanopayments
      </p>
      <h1 className="mt-3 text-5xl font-semibold">Stamp</h1>
      <p className="mt-4 text-lg text-slate-300">
        Pay-to-reach inbox. Senders stake USDC to get a stranger&rsquo;s
        attention. If the message is worth reading, the stake is refunded. If
        it&rsquo;s spam, the recipient keeps it.
      </p>
      <p className="mt-4 text-slate-400">
        Economic friction for AI-generated noise, settled per-message on Arc
        with sub-cent gas. Impossible with Stripe&rsquo;s $0.30 minimum or
        Ethereum mainnet&rsquo;s volatile gas — viable on Arc.
      </p>
      <div className="mt-10 flex gap-3">
        <Link
          href="/auth/sign-up"
          className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Create inbox
        </Link>
        <Link
          href="/auth/sign-in"
          className="rounded-md border border-slate-800 px-5 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-900"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
