import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { triageStamp, triageBatch } from "@/lib/stamp";

const bodyZ = z.object({
  stampIds: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(["refund", "forfeit"]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = session.user as typeof session.user & {
    id: string;
    walletId?: string;
  };
  if (!user.walletId) {
    return NextResponse.json({ error: "no wallet" }, { status: 400 });
  }

  const parsed = bodyZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    if (parsed.data.stampIds.length === 1) {
      const r = await triageStamp({
        userId: user.id,
        walletId: user.walletId,
        stampId: parsed.data.stampIds[0],
        action: parsed.data.action,
      });
      return NextResponse.json({ ok: true, count: 1, ...r });
    }
    const r = await triageBatch({
      userId: user.id,
      walletId: user.walletId,
      stampIds: parsed.data.stampIds,
      action: parsed.data.action,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
