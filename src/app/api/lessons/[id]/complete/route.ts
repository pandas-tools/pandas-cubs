import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";

const bodySchema = z.object({
  rating: z.number().int().min(1).max(5),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || !session.user.clientId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  try {
    const sdb = scopedDb({
      id: session.user.id,
      clientId: session.user.clientId,
      role: "employee",
    });
    const [row] = await sdb.completions.upsert(id, parsed.data.rating);
    return NextResponse.json({ ok: true, completion: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
