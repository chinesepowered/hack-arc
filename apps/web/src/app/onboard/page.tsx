import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/lib/db";
import { OnboardActions } from "./OnboardActions";
import { AppHeader } from "@/components/app-header";

export default async function OnboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/sign-in?next=/onboard");

  const userId = (session.user as { id: string }).id;
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  const hasWallet = Boolean(user?.walletId && user?.walletAddress);

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold">Wallet setup</h1>
        {hasWallet ? (
          <>
            <p className="mt-2 text-sm text-emerald-300">
              Your Arc wallet is ready: <code className="font-mono">{user!.walletAddress}</code>
            </p>
            <p className="mt-4 text-sm text-slate-400">
              Fund it with testnet USDC at{" "}
              <a
                href="https://faucet.circle.com"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:underline"
              >
                faucet.circle.com
              </a>
              . USDC pays for both gas and stamp stakes on Arc.
            </p>
            <Link
              href="/inbox"
              className="mt-8 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Go to inbox
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-amber-300">
              Your wallet wasn&rsquo;t provisioned during signup. Retry below.
              This is almost always a Circle API credential issue — check
              <code className="mx-1 font-mono">CIRCLE_API_KEY</code>,
              <code className="mx-1 font-mono">CIRCLE_ENTITY_SECRET</code>, and
              <code className="mx-1 font-mono">CIRCLE_WALLET_SET_ID</code> in
              your <code className="font-mono">.env</code>.
            </p>
            <OnboardActions />
          </>
        )}
      </main>
    </>
  );
}
