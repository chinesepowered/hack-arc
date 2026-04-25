import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/lib/db";
import { sendStamp } from "@/lib/stamp";

const bodyZ = z.object({
  toHandle: z.string().min(1).max(64),
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
 * Demo: simulate a spam wave. The acting (signed-in) user is the spammer;
 * `toHandle` is the victim whose inbox will be flooded.
 *
 * Each stamp is 2 onchain tx (approve + sendStamp). At the default count=25
 * and stake=$0.10 this produces 50 tx and consumes $2.50 of the spammer's
 * USDC balance plus trivial gas.
 *
 * NOTE: this runs serially (Circle wallet nonce ordering); 25 stamps takes
 * 1–3 minutes. In `next dev` there is no request timeout. On Vercel the
 * serverless function timeout will kill it — either use a background
 * worker or lower the count.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = session.user as typeof session.user & {
    id: string;
    handle?: string;
    walletId?: string;
    walletAddress?: string;
  };

  const parsed = bodyZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const toHandle = parsed.data.toHandle.toLowerCase();

  if (user.handle && toHandle === user.handle.toLowerCase()) {
    return NextResponse.json(
      { error: "can't spam yourself — sign in as a different account" },
      { status: 400 }
    );
  }

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
    // Suffix each body so every stamp has a distinct content hash onchain;
    // same subject/body would otherwise collide and be less realistic.
    const body = `${SAMPLE_BODIES[i % SAMPLE_BODIES.length]}\n\n[batch ${Date.now()}#${i}]`;
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
