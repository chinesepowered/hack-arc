import Link from "next/link";
import { auth, signOut } from "@/auth";
import { shortAddress } from "@/lib/utils";
import { explorerAddress } from "@/lib/arc";

export async function AppHeader() {
  const session = await auth();
  const user = session?.user as
    | {
        handle?: string;
        walletAddress?: string;
      }
    | undefined;

  return (
    <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/inbox" className="text-sm font-semibold tracking-tight">
          <span className="text-indigo-400">◆</span> Stamp
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/inbox" className="text-slate-300 hover:text-white">
            Inbox
          </Link>
          <Link href="/sent" className="text-slate-300 hover:text-white">
            Sent
          </Link>
          <Link href="/compose" className="text-slate-300 hover:text-white">
            Compose
          </Link>
          <Link href="/demo" className="text-slate-300 hover:text-white">
            Demo
          </Link>
          {user?.walletAddress && (
            <a
              href={explorerAddress(user.walletAddress)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-slate-500 hover:text-indigo-400"
              title={user.walletAddress}
            >
              {shortAddress(user.walletAddress)}
            </a>
          )}
          {user && (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button className="text-slate-500 hover:text-white" type="submit">
                Sign out
              </button>
            </form>
          )}
        </nav>
      </div>
    </header>
  );
}
