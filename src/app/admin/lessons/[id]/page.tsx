import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  lessons,
  lessonTranslations,
  clientLessons,
  clients,
} from "@/lib/db/schema";
import PublishToggle from "./PublishToggle";
import AssignmentManager from "./AssignmentManager";
import TranslationsManager from "./TranslationsManager";

export const dynamic = "force-dynamic";

export default async function LessonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") notFound();

  const { id } = await params;
  const [[lesson], translations, assignments, allClients] = await Promise.all([
    db.select().from(lessons).where(eq(lessons.id, id)).limit(1),
    db
      .select()
      .from(lessonTranslations)
      .where(eq(lessonTranslations.lessonId, id)),
    db.select().from(clientLessons).where(eq(clientLessons.lessonId, id)),
    db.select().from(clients).orderBy(clients.name),
  ]);

  if (!lesson) notFound();

  const en = translations.find((t) => t.language === "en");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/lessons"
            className="text-sm text-zinc-500 hover:text-zinc-900"
          >
            ← Back to lessons
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{lesson.internalName}</h1>
          {en && (
            <p className="text-sm text-zinc-600">
              {en.title}
              {en.description ? ` — ${en.description}` : ""}
            </p>
          )}
        </div>
        <PublishToggle
          lessonId={lesson.id}
          isPublished={lesson.isPublished}
        />
      </div>

      <section>
        <h2 className="text-sm font-medium text-zinc-700 mb-2">
          Translations
        </h2>
        <p className="text-xs text-zinc-500 mb-2">
          The English translation is required and acts as the system-wide
          fallback. Add other languages with their own title + description +
          video (dubbed) or sharing the English video (subtitled — Mux
          auto-generates captions per asset).
        </p>
        <TranslationsManager
          lessonId={lesson.id}
          translations={translations.map((t) => ({
            id: t.id,
            language: t.language,
            title: t.title,
            description: t.description,
            notesMarkdown: t.notesMarkdown,
            muxPlaybackId: t.muxPlaybackId,
            muxUploadId: t.muxUploadId,
            durationSeconds: t.durationSeconds,
            thumbnailUrl: t.thumbnailUrl,
          }))}
        />
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-700 mb-2">Assignments</h2>
        <AssignmentManager
          lessonId={lesson.id}
          clients={allClients}
          assignedIds={assignments.map((a) => a.clientId)}
        />
      </section>
    </div>
  );
}
