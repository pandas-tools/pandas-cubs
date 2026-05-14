import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users, stores } from "@/lib/db/schema";

const bodySchema = z.object({
  preferredLanguage: z.string().min(2).max(8).optional(),
  subtitlesEnabled: z.boolean().optional(),
  storeId: z.string().uuid().nullable().optional(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // Validate storeId belongs to user's client
  if (parsed.data.storeId) {
    const [store] = await db
      .select()
      .from(stores)
      .where(eq(stores.id, parsed.data.storeId))
      .limit(1);
    if (!store || store.clientId !== session.user.clientId) {
      return NextResponse.json({ error: "invalid store" }, { status: 400 });
    }
  }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.preferredLanguage !== undefined)
    update.preferredLanguage = parsed.data.preferredLanguage;
  if (parsed.data.subtitlesEnabled !== undefined)
    update.subtitlesEnabled = parsed.data.subtitlesEnabled;
  if (parsed.data.storeId !== undefined) {
    update.storeId = parsed.data.storeId;
    update.storeConfirmedAt = new Date();
  }

  await db.update(users).set(update).where(eq(users.id, session.user.id));
  return NextResponse.json({ ok: true });
}
