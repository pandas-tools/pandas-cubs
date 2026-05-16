"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { lessons, lessonTranslations } from "@/lib/db/schema";

async function requireAdminLesson(lessonId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("forbidden");
  }
  const [lesson] = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!lesson) throw new Error("Lesson not found");
  return { session, lesson };
}

const SUPPORTED_LANGUAGES = ["en", "fr", "nl", "de", "es", "it", "pt"] as const;
type Lang = (typeof SUPPORTED_LANGUAGES)[number];

function isSupportedLang(value: string): value is Lang {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export async function addTranslation(input: {
  lessonId: string;
  language: string;
  title: string;
  description?: string;
  notesMarkdown?: string;
}) {
  try {
    await requireAdminLesson(input.lessonId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "forbidden" };
  }
  if (!isSupportedLang(input.language)) {
    return { error: `Language "${input.language}" is not supported` };
  }
  const title = input.title.trim();
  if (!title) return { error: "Title is required" };

  // Reject duplicates (also enforced by unique constraint)
  const [existing] = await db
    .select()
    .from(lessonTranslations)
    .where(
      and(
        eq(lessonTranslations.lessonId, input.lessonId),
        eq(lessonTranslations.language, input.language),
      ),
    )
    .limit(1);
  if (existing) {
    return { error: `A "${input.language}" translation already exists` };
  }

  const [created] = await db
    .insert(lessonTranslations)
    .values({
      lessonId: input.lessonId,
      language: input.language,
      title,
      description: input.description?.trim() || null,
      notesMarkdown: input.notesMarkdown?.trim() || null,
    })
    .returning();
  revalidatePath("/admin/lessons");
  revalidatePath(`/admin/lessons/${input.lessonId}`);
  return { ok: true, translationId: created.id };
}

export async function updateTranslation(input: {
  translationId: string;
  lessonId: string;
  title?: string;
  description?: string | null;
  notesMarkdown?: string | null;
}) {
  try {
    await requireAdminLesson(input.lessonId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "forbidden" };
  }
  const [t] = await db
    .select()
    .from(lessonTranslations)
    .where(eq(lessonTranslations.id, input.translationId))
    .limit(1);
  if (!t || t.lessonId !== input.lessonId) {
    return { error: "Translation does not belong to this lesson" };
  }
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) return { error: "Title cannot be empty" };
    patch.title = title;
  }
  if (input.description !== undefined)
    patch.description = input.description?.trim() || null;
  if (input.notesMarkdown !== undefined)
    patch.notesMarkdown = input.notesMarkdown?.trim() || null;

  await db
    .update(lessonTranslations)
    .set(patch)
    .where(eq(lessonTranslations.id, input.translationId));
  revalidatePath(`/admin/lessons/${input.lessonId}`);
  return { ok: true };
}

export async function deleteTranslation(input: {
  translationId: string;
  lessonId: string;
}) {
  try {
    await requireAdminLesson(input.lessonId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "forbidden" };
  }
  const [t] = await db
    .select()
    .from(lessonTranslations)
    .where(eq(lessonTranslations.id, input.translationId))
    .limit(1);
  if (!t || t.lessonId !== input.lessonId) {
    return { error: "Translation does not belong to this lesson" };
  }
  if (t.language === "en") {
    return {
      error:
        "The English translation is required (system-wide fallback). Edit it instead.",
    };
  }
  await db
    .delete(lessonTranslations)
    .where(eq(lessonTranslations.id, input.translationId));
  revalidatePath(`/admin/lessons/${input.lessonId}`);
  revalidatePath("/admin/lessons");
  return { ok: true };
}

/**
 * Share the English translation's Mux asset with another translation.
 * Use case: same video, different subtitle track (Mux auto-generates subtitles
 * per-asset, so to get a French subtitle track you'd normally re-upload).
 * For simple "subtitled" mode where the language difference is only in title +
 * description + notes (the video itself stays English), this copies the asset.
 */
export async function copyMuxFromEnglish(input: {
  translationId: string;
  lessonId: string;
}) {
  try {
    await requireAdminLesson(input.lessonId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "forbidden" };
  }
  const [t] = await db
    .select()
    .from(lessonTranslations)
    .where(eq(lessonTranslations.id, input.translationId))
    .limit(1);
  if (!t || t.lessonId !== input.lessonId) {
    return { error: "Translation does not belong to this lesson" };
  }
  if (t.language === "en") {
    return { error: "Cannot copy English onto itself" };
  }
  const [en] = await db
    .select()
    .from(lessonTranslations)
    .where(
      and(
        eq(lessonTranslations.lessonId, input.lessonId),
        eq(lessonTranslations.language, "en"),
      ),
    )
    .limit(1);
  if (!en || !en.muxPlaybackId) {
    return { error: "English video isn't ready yet — upload it first" };
  }
  await db
    .update(lessonTranslations)
    .set({
      muxAssetId: en.muxAssetId,
      muxPlaybackId: en.muxPlaybackId,
      muxUploadId: null,
      durationSeconds: en.durationSeconds,
      thumbnailUrl: en.thumbnailUrl,
    })
    .where(eq(lessonTranslations.id, input.translationId));
  revalidatePath(`/admin/lessons/${input.lessonId}`);
  revalidatePath("/admin/lessons");
  return { ok: true };
}

/**
 * Clear the Mux fields on a translation so a new upload can begin from scratch.
 * Doesn't delete the Mux asset itself (that lives on Mux's side and continues
 * to serve playback for any other translation that still references it).
 */
export async function clearMux(input: {
  translationId: string;
  lessonId: string;
}) {
  try {
    await requireAdminLesson(input.lessonId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "forbidden" };
  }
  const [t] = await db
    .select()
    .from(lessonTranslations)
    .where(eq(lessonTranslations.id, input.translationId))
    .limit(1);
  if (!t || t.lessonId !== input.lessonId) {
    return { error: "Translation does not belong to this lesson" };
  }
  await db
    .update(lessonTranslations)
    .set({
      muxAssetId: null,
      muxPlaybackId: null,
      muxUploadId: null,
      durationSeconds: null,
      thumbnailUrl: null,
    })
    .where(eq(lessonTranslations.id, input.translationId));
  revalidatePath(`/admin/lessons/${input.lessonId}`);
  return { ok: true };
}
