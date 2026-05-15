import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import {
  lessons,
  lessonTranslations,
  clientLessons,
  clients,
} from "@/lib/db/schema";
import NewLessonForm from "./NewLessonForm";
import { auth } from "@/lib/auth";

export const metadata = { title: "Lessons · Admin · Dojo" };
export const dynamic = "force-dynamic";

export default async function AdminLessonsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") notFound();

  const [list, allTranslations, allAssignments, allClients] = await Promise.all([
    db.select().from(lessons).orderBy(lessons.sortOrder, lessons.createdAt),
    db.select().from(lessonTranslations),
    db.select().from(clientLessons),
    db.select().from(clients),
  ]);

  const transByLesson = new Map<string, typeof allTranslations>();
  for (const t of allTranslations) {
    const arr = transByLesson.get(t.lessonId) ?? [];
    arr.push(t);
    transByLesson.set(t.lessonId, arr);
  }

  const assignmentsByLesson = new Map<string, string[]>();
  for (const a of allAssignments) {
    const arr = assignmentsByLesson.get(a.lessonId) ?? [];
    arr.push(a.clientId);
    assignmentsByLesson.set(a.lessonId, arr);
  }

  const clientNameById = new Map(allClients.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Lessons</h1>
          <p className="text-sm text-zinc-600 mt-1">
            Create, upload, assign. English-only for now; per-language
            translations land in a later phase.
          </p>
        </div>
      </div>

      <section>
        <h2 className="text-sm font-medium text-zinc-700 mb-2">
          New lesson
        </h2>
        <div className="rounded-md border border-zinc-200 bg-white p-4">
          <NewLessonForm />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-700 mb-2">All lessons</h2>
        <div className="rounded-md border border-zinc-200 bg-white overflow-hidden">
          {list.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">
              No lessons yet. Create one above.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-2">Internal name</th>
                  <th className="px-4 py-2">Translations</th>
                  <th className="px-4 py-2">Assigned to</th>
                  <th className="px-4 py-2">Published</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((l) => {
                  const ts = transByLesson.get(l.id) ?? [];
                  const assigned = assignmentsByLesson.get(l.id) ?? [];
                  return (
                    <tr key={l.id} className="border-t border-zinc-200">
                      <td className="px-4 py-2 font-medium">
                        {l.internalName}
                      </td>
                      <td className="px-4 py-2 text-zinc-600">
                        {ts.length === 0
                          ? "—"
                          : ts
                              .map(
                                (t) =>
                                  `${t.language}${t.muxPlaybackId ? " ✓" : " ⏳"}`,
                              )
                              .join(", ")}
                      </td>
                      <td className="px-4 py-2 text-zinc-600">
                        {assigned.length === 0
                          ? "—"
                          : assigned
                              .map((id) => clientNameById.get(id) ?? id)
                              .join(", ")}
                      </td>
                      <td className="px-4 py-2">
                        {l.isPublished ? "✓" : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link
                          href={`/admin/lessons/${l.id}`}
                          className="text-zinc-700 hover:underline"
                        >
                          Manage →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
