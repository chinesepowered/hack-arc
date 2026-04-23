"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SignUpPage() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle, displayName, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "signup failed");
      const login = await signIn("credentials", {
        handle,
        password,
        redirect: false,
      });
      if (login?.error) throw new Error(login.error);
      router.push("/inbox");
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col px-6 py-20">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-300">
        ← back
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">Create your inbox</h1>
      <p className="mt-2 text-sm text-slate-400">
        We&rsquo;ll provision a Circle wallet for you automatically. No seed
        phrases, no MetaMask.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wider text-slate-500">
            Handle
          </label>
          <Input
            required
            minLength={2}
            maxLength={64}
            pattern="[a-zA-Z0-9_-]+"
            placeholder="alice"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-slate-500">
            Display name (optional)
          </label>
          <Input
            maxLength={128}
            placeholder="Alice Chen"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-slate-500">
            Password
          </label>
          <Input
            required
            type="password"
            minLength={4}
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
          {loading ? "Provisioning wallet…" : "Create inbox"}
        </Button>
        <p className="text-center text-sm text-slate-500">
          Already have one?{" "}
          <Link href="/auth/sign-in" className="text-indigo-400 hover:text-indigo-300">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
