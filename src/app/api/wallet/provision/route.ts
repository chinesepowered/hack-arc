import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/lib/db";
import { createWallet } from "@/lib/circle";

/**
 * Retry wallet provisioning for the current user. Used when the wallet
 * creation failed during signup. No-op if the user already has a wallet.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = session.user as typeof session.user & {
    id: string;
    walletId?: string;
    walletAddress?: string;
  };

  if (user.walletId && user.walletAddress) {
    return NextResponse.json({
      ok: true,
      walletId: user.walletId,
      walletAddress: user.walletAddress,
    });
  }

  try {
    const wallet = await createWallet(user.id);
    await db
      .update(schema.users)
      .set({ walletId: wallet.id, walletAddress: wallet.address.toLowerCase() })
      .where(eq(schema.users.id, user.id));
    return NextResponse.json({
      ok: true,
      walletId: wallet.id,
      walletAddress: wallet.address,
      note: "sign out and back in to refresh your session with the new wallet",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
