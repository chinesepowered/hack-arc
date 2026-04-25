import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db, schema } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = session.user as typeof session.user & { id: string };

  const folder = req.nextUrl.searchParams.get("folder") ?? "inbox";
  const status = req.nextUrl.searchParams.get("status"); // optional filter

  let q;
  if (folder === "sent") {
    q = db
      .select()
      .from(schema.stamps)
      .where(eq(schema.stamps.senderId, user.id))
      .orderBy(desc(schema.stamps.createdAt))
      .limit(100);
  } else {
    const statusFilter = status
      ? inArray(schema.stamps.status, [status as "pending"])
      : undefined;
    q = db
      .select()
      .from(schema.stamps)
      .where(
        statusFilter
          ? and(eq(schema.stamps.recipientId, user.id), statusFilter)
          : eq(schema.stamps.recipientId, user.id)
      )
      .orderBy(desc(schema.stamps.createdAt))
      .limit(100);
  }

  const rows = await q;
  return NextResponse.json({
    stamps: rows.map((r) => ({
      ...r,
      onchainId: r.onchainId?.toString() ?? null,
    })),
  });
}
