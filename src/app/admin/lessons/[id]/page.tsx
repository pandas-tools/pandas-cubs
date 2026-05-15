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
import UploadWidget from "./UploadWidget";
import PublishToggle from "./PublishToggle";
import AssignmentManager from "./AssignmentManager";

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
          English video
        </h2>
        <div className="rounded-md border border-zinc-200 bg-white p-4">
          {en?.muxPlaybackId ? (
            <div className="text-sm space-y-1">
              <p className="text-emerald-700">
                ✓ Ready — playback ID{" "}
                <code className="font-mono text-xs">{en.muxPlaybackId}</code>
              </p>
              <p className="text-zinc-600">
                Duration:{" "}
                {en.durationSeconds
                  ? en.durationSeconds < 60
                    ? `${en.durationSeconds}s`
                    : `${Math.round(en.durationSeconds / 60)} min`
                  : "—"}
              </p>
              {en.thumbnailUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={en.thumbnailUrl}
                  alt="Thumbnail"
                  className="mt-2 max-w-xs rounded-md border border-zinc-200"
                />
              )}
            </div>
          ) : en?.muxUploadId ? (
            <p className="text-sm text-amber-700">
              ⏳ Upload in progress / Mux processing. Refresh in a minute.
            </p>
          ) : (
            <UploadWidget lessonId={lesson.id} translationId={en?.id ?? null} />
          )}
        </div>
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
