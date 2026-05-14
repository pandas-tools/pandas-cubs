import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { lessonTranslations, lessons } from "@/lib/db/schema";
import { createDirectUpload } from "@/lib/mux";
import { env } from "@/lib/env";

const bodySchema = z.object({
  lessonId: z.string().uuid(),
  translationId: z.string().uuid().nullable(),
  language: z.string().min(2).max(8).default("en"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // Verify lesson exists
  const [lesson] = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, parsed.data.lessonId))
    .limit(1);
  if (!lesson) {
    return NextResponse.json({ error: "lesson not found" }, { status: 404 });
  }

  // Ensure a translation row exists for this language (lazy-create)
  let translationId = parsed.data.translationId;
  if (translationId) {
    const [t] = await db
      .select()
      .from(lessonTranslations)
      .where(eq(lessonTranslations.id, translationId))
      .limit(1);
    if (!t || t.lessonId !== parsed.data.lessonId) {
      return NextResponse.json(
        { error: "translation does not belong to lesson" },
        { status: 400 },
      );
    }
  } else {
    // Find existing by (lesson, language)
    const [existing] = await db
      .select()
      .from(lessonTranslations)
      .where(
        and(
          eq(lessonTranslations.lessonId, parsed.data.lessonId),
          eq(lessonTranslations.language, parsed.data.language),
        ),
      )
      .limit(1);
    if (existing) {
      translationId = existing.id;
    } else {
      const [created] = await db
        .insert(lessonTranslations)
        .values({
          lessonId: parsed.data.lessonId,
          language: parsed.data.language,
          title: lesson.internalName,
        })
        .returning();
      translationId = created.id;
    }
  }

  const lang = parsed.data.language;
  const supportedSubs = [
    "en",
    "es",
    "it",
    "pt",
    "de",
    "fr",
    "pl",
    "ru",
    "nl",
    "ca",
    "tr",
    "sv",
    "uk",
    "no",
    "fi",
    "sk",
    "el",
    "cs",
    "hr",
    "da",
    "ro",
    "bg",
  ] as const;
  type Supported = (typeof supportedSubs)[number];
  const subLang = (supportedSubs as readonly string[]).includes(lang)
    ? (lang as Supported)
    : ("en" as Supported);

  const upload = await createDirectUpload({
    corsOrigin: env().NEXT_PUBLIC_SITE_URL,
    language: subLang,
  });

  // Stash the upload id on the translation so the webhook can find the row
  await db
    .update(lessonTranslations)
    .set({ muxUploadId: upload.id })
    .where(eq(lessonTranslations.id, translationId));

  return NextResponse.json({ url: upload.url, id: upload.id, translationId });
}
