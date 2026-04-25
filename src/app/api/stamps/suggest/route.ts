import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/lib/db";
import { llm, LLM_MODEL } from "@/lib/llm";

const bodyZ = z.object({
  stampIds: z.array(z.string().uuid()).min(1).max(50),
});

const SYSTEM = `You triage cold-outreach messages arriving at a stranger's
pay-to-reach inbox. For each message, classify as "legit" (worth reading; the
recipient should refund the stake) or "spam" (not worth reading; the recipient
should forfeit the stake). Use "unsure" sparingly.

Return ONLY a compact JSON array — no prose — one object per message, in the
SAME ORDER as given:
[{"id":"<id>","label":"legit|spam|unsure","reason":"<short>"}]`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = session.user as typeof session.user & { id: string };

  const parsed = bodyZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(schema.stamps)
    .where(
      and(
        inArray(schema.stamps.id, parsed.data.stampIds),
        eq(schema.stamps.recipientId, user.id),
        eq(schema.stamps.status, "pending")
      )
    );
  if (!rows.length) return NextResponse.json({ suggestions: [] });

  const asked = rows.map((r) => ({
    id: r.id,
    from: r.senderAddress,
    subject: r.subject,
    body: r.body.slice(0, 1500),
  }));

  const resp = await llm.chat.completions.create({
    model: LLM_MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: JSON.stringify(asked) },
    ],
    temperature: 0,
  });

  const text = resp.choices[0]?.message?.content ?? "";

  let suggestions: Array<{ id: string; label: "legit" | "spam" | "unsure"; reason: string }> = [];
  try {
    const jsonStart = text.indexOf("[");
    const jsonEnd = text.lastIndexOf("]");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      suggestions = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    }
  } catch (err) {
    console.error("failed to parse triage suggestions", err, text);
  }

  for (const s of suggestions) {
    await db
      .update(schema.stamps)
      .set({ aiTriageLabel: s.label, aiTriageReason: s.reason })
      .where(eq(schema.stamps.id, s.id));
  }

  return NextResponse.json({ suggestions });
}
