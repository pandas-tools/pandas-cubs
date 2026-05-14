"use server";

import { eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  lessons,
  lessonTranslations,
  clientLessons,
} from "@/lib/db/schema";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("forbidden");
  }
  return session;
}

export async function createLesson(input: {
  internalName: string;
  title: string;
  description?: string;
}) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  if (!input.internalName.trim() || !input.title.trim()) {
    return { error: "internalName and title are required" };
  }

  // Find next sort_order
  const [{ value: currentMax }] = await db
    .select({ value: max(lessons.sortOrder) })
    .from(lessons);
  const nextSort = (currentMax ?? 0) + 10;

  const [lesson] = await db
    .insert(lessons)
    .values({
      internalName: input.internalName.trim(),
      type: "training",
      sortOrder: nextSort,
      isPublished: false,
    })
    .returning();

  await db.insert(lessonTranslations).values({
    lessonId: lesson.id,
    language: "en",
    title: input.title.trim(),
    description: input.description?.trim() || null,
  });

  revalidatePath("/admin/lessons");
  return { ok: true, lessonId: lesson.id };
}

export async function togglePublish(lessonId: string, isPublished: boolean) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  await db
    .update(lessons)
    .set({ isPublished })
    .where(eq(lessons.id, lessonId));
  revalidatePath("/admin/lessons");
  revalidatePath(`/admin/lessons/${lessonId}`);
  return { ok: true };
}

export async function assignToClient(lessonId: string, clientId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  await db
    .insert(clientLessons)
    .values({ lessonId, clientId })
    .onConflictDoNothing();
  revalidatePath("/admin/lessons");
  revalidatePath(`/admin/lessons/${lessonId}`);
  return { ok: true };
}

export async function unassignFromClient(lessonId: string, clientId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  const { and } = await import("drizzle-orm");
  await db
    .delete(clientLessons)
    .where(
      and(
        eq(clientLessons.lessonId, lessonId),
        eq(clientLessons.clientId, clientId),
      ),
    );
  revalidatePath("/admin/lessons");
  revalidatePath(`/admin/lessons/${lessonId}`);
  return { ok: true };
}

export async function deleteLesson(lessonId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "forbidden" };
  }
  await db.delete(lessons).where(eq(lessons.id, lessonId));
  revalidatePath("/admin/lessons");
  return { ok: true };
}
