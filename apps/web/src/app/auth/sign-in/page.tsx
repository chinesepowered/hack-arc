"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SignInPage({
  searchParams,
}: {
  // Next.js 16: searchParams is async
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = use(searchParams);
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const login = await signIn("credentials", {
      handle,
      password,
      redirect: false,
    });
    setLoading(false);
    if (login?.error) {
      setError("Invalid handle or password");
      return;
    }
    router.push(next ?? "/inbox");
  }

  return (
    <main className="mx-auto flex max-w-md flex-col px-6 py-20">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-300">
        ← back
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">Sign in</h1>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wider text-slate-500">
            Handle
          </label>
          <Input
            required
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-slate-500">
            Password
          </label>
          <Input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p className="rounded border border-rose-900 bg-rose-950/50 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-center text-sm text-slate-500">
          No inbox yet?{" "}
          <Link href="/auth/sign-up" className="text-indigo-400 hover:text-indigo-300">
            Create one
          </Link>
        </p>
      </form>
    </main>
  );
}
