import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/lib/db";
import { sendStamp } from "@/lib/stamp";

const bodyZ = z.object({
  fromHandle: z.string().min(1).max(64),
  count: z.number().int().min(1).max(30),
  stakeUsdc: z.string().regex(/^\d+(\.\d{1,6})?$/).default("0.10"),
});

const SAMPLE_SUBJECTS = [
  "Unlock $10K/mo with our AI SDR",
  "I saw your LinkedIn — partnership?",
  "Boost your SEO by 300% this week",
  "Important: regarding your domain",
  "Web3 grant application — your project qualifies",
  "Quick question about your product",
  "Re: our call (never had one)",
  "Crypto airdrop eligibility",
  "You have unclaimed tokens",
  "Exclusive founder invite",
  "Guest post opportunity on DA70 site",
  "Content for your blog?",
  "Get on Forbes — 3 spots left",
  "VIP list for <company> event",
  "Your website has 12 critical issues",
];

const SAMPLE_BODIES = [
  "Hi founder, I noticed you're building something cool. We help startups like yours 10x revenue with our AI-powered outbound. Can we hop on a 15-min call?",
  "Hey, I'll be brief. Our platform integrates with your stack in under an hour and typically saves clients 40 hours/week. Interested?",
  "Congrats on the recent traction. We've helped 200+ similar companies scale with our proprietary growth framework. Time for a quick chat?",
  "Hi! I'm reaching out about a partnership opportunity. We have 50K users in your target segment. Reply YES if you want details.",
  "Dear Sir/Madam, We are a Nigerian prince — wait, that's the old script. Our new one: we are a Web3 VC with $50M ready to deploy.",
];

/**
 * Demo: simulate a spam wave. The acting user (spammer) sends `count`
 * stamped messages to `toHandle`. This produces 2 * count onchain tx (each
 * send = approve + sendStamp), which is useful for quickly accumulating the
 * 50+ tx the hackathon demo requires.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = session.user as typeof session.user & {
    id: string;
    walletId?: string;
    walletAddress?: string;
  };

  const parsed = bodyZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Use the "spam bot" account the user has configured/seeded. For the demo
  // the simplest path is: send FROM the currently signed-in user TO
  // `fromHandle` (sic — it's the handle that will receive the wave; see UI).
  // We swap names below so the API reads naturally.
  const toHandle = parsed.data.fromHandle.toLowerCase();
  const [recipient] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.handle, toHandle))
    .limit(1);
  if (!recipient) {
    return NextResponse.json({ error: "recipient handle not found" }, { status: 404 });
  }
  if (!user.walletId || !user.walletAddress) {
    return NextResponse.json({ error: "current user has no wallet" }, { status: 400 });
  }

  const results: Array<{ ok: boolean; txHash?: string; error?: string }> = [];
  for (let i = 0; i < parsed.data.count; i++) {
    const subject = SAMPLE_SUBJECTS[i % SAMPLE_SUBJECTS.length];
    const body = SAMPLE_BODIES[i % SAMPLE_BODIES.length];
    try {
      const r = await sendStamp({
        senderId: user.id,
        senderWalletId: user.walletId,
        senderAddress: user.walletAddress,
        recipientHandle: toHandle,
        subject,
        body,
        stakeUsdc: parsed.data.stakeUsdc,
      });
      results.push({ ok: true, txHash: r.txHash });
    } catch (err) {
      results.push({
        ok: false,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return NextResponse.json({
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
