import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { createWallet } from "@/lib/circle";

const schemaZ = z.object({
  handle: z.string().min(2).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  displayName: z.string().min(1).max(128).optional(),
  password: z.string().min(4).max(128),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schemaZ.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const handle = parsed.data.handle.toLowerCase();

  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.handle, handle))
    .limit(1);
  if (existing.length) {
    return NextResponse.json({ error: "handle taken" }, { status: 409 });
  }

  const id = randomUUID();
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  // Insert the user row first so the Circle refId is deterministic.
  await db.insert(schema.users).values({
    id,
    handle,
    displayName: parsed.data.displayName ?? handle,
    passwordHash,
    createdAt: new Date(),
  });

  // Provision the Circle Developer-Controlled Wallet. If this fails the user
  // can retry via /onboard; we don't roll back the user row.
  try {
    const wallet = await createWallet(id);
    await db
      .update(schema.users)
      .set({ walletId: wallet.id, walletAddress: wallet.address.toLowerCase() })
      .where(eq(schema.users.id, id));
    return NextResponse.json({
      ok: true,
      userId: id,
      handle,
      walletAddress: wallet.address,
    });
  } catch (err) {
    console.error("wallet provisioning failed", err);
    return NextResponse.json({
      ok: true,
      userId: id,
      handle,
      walletAddress: null,
      warning: "wallet provisioning failed; retry from /onboard",
    });
  }
}
