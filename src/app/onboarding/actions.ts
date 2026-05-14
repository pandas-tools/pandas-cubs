"use server";

import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users, stores } from "@/lib/db/schema";

export async function completeOnboarding(input: {
  language: string;
  storeId: string | null;
}) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated" };
  if (session.user.role === "admin") return { error: "Admin onboarding skipped" };
  if (!session.user.clientId) return { error: "No client_id on user" };

  // If storeId is set, verify it belongs to user's client (defense in depth)
  if (input.storeId) {
    const [store] = await db
      .select()
      .from(stores)
      .where(eq(stores.id, input.storeId))
      .limit(1);
    if (!store || store.clientId !== session.user.clientId) {
      return { error: "Invalid store" };
    }
  }

  await db
    .update(users)
    .set({
      preferredLanguage: input.language,
      storeId: input.storeId,
      onboardingCompleted: true,
      storeConfirmedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  return { ok: true };
}
