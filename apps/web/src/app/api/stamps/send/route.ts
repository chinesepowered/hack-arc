import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { sendStamp } from "@/lib/stamp";

const bodyZ = z.object({
  recipientHandle: z.string().min(1).max(64),
  subject: z.string().min(1).max(256),
  body: z.string().min(1).max(4000),
  stakeUsdc: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, "USDC amount with up to 6 decimals"),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = session.user as typeof session.user & {
    id: string;
    walletId?: string;
    walletAddress?: string;
  };
  if (!user.walletId || !user.walletAddress) {
    return NextResponse.json(
      { error: "no wallet provisioned for this user" },
      { status: 400 }
    );
  }

  const parsed = bodyZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await sendStamp({
      senderId: user.id,
      senderWalletId: user.walletId,
      senderAddress: user.walletAddress,
      recipientHandle: parsed.data.recipientHandle,
      subject: parsed.data.subject,
      body: parsed.data.body,
      stakeUsdc: parsed.data.stakeUsdc,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
