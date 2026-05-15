import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  clients,
  clientAllowedDomains,
  clientLanguages,
  clientLessons,
  stores,
  users,
  lessons,
  lessonTranslations,
} from "@/lib/db/schema";
import ClientDetailEditor from "./ClientDetailEditor";
import DomainsEditor from "./DomainsEditor";
import LanguagesEditor from "./LanguagesEditor";
import DeleteClientButton from "./DeleteClientButton";

export const metadata = { title: "Client · Admin · Dojo" };
export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") notFound();

  const { id } = await params;
  const [[client], domains, langs, assignments, clientStores, clientUsers] =
    await Promise.all([
      db.select().from(clients).where(eq(clients.id, id)).limit(1),
      db
        .select()
        .from(clientAllowedDomains)
        .where(eq(clientAllowedDomains.clientId, id)),
      db.select().from(clientLanguages).where(eq(clientLanguages.clientId, id)),
      db.select().from(clientLessons).where(eq(clientLessons.clientId, id)),
      db.select().from(stores).where(eq(stores.clientId, id)),
      db.select().from(users).where(eq(users.clientId, id)),
    ]);

  if (!client) notFound();

  // Lessons assigned to this client (read-only here; assignment lives on /admin/lessons)
  let assignedLessonRows: { id: string; internalName: string; title: string | null }[] = [];
  if (assignments.length > 0) {
    const lessonIds = assignments.map((a) => a.lessonId);
    const lessonRows = await db.query.lessons.findMany({
      where: (l, { inArray }) => inArray(l.id, lessonIds),
      orderBy: (l, { asc }) => [asc(l.sortOrder)],
    });
    const enTranslations = await db
      .select()
      .from(lessonTranslations)
      .where(eq(lessonTranslations.language, "en"));
    const titleByLesson = new Map(
      enTranslations.map((t) => [t.lessonId, t.title]),
    );
    assignedLessonRows = lessonRows.map((l) => ({
      id: l.id,
      internalName: l.internalName,
      title: titleByLesson.get(l.id) ?? null,
    }));
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/clients"
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Back to clients
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{client.name}</h1>
        <p className="text-xs text-zinc-500">slug: {client.slug}</p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-zinc-700 mb-2">Details</h2>
        <ClientDetailEditor client={client} />
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-700 mb-2">
          Allowed email domains
        </h2>
        <p className="text-xs text-zinc-500 mb-2">
          Any employee with an email at one of these domains can sign in
          and is auto-assigned to this client.
        </p>
        <DomainsEditor
          clientId={client.id}
          domains={domains.map((d) => d.domain)}
        />
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-700 mb-2">
          Language picker
        </h2>
        <p className="text-xs text-zinc-500 mb-2">
          Which languages employees see in the onboarding language picker.
          English is the system-wide fallback and should always be enabled.
        </p>
        <LanguagesEditor
          clientId={client.id}
          languages={langs.map((l) => l.language)}
        />
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-700 mb-2">Stats</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4 rounded-md border border-zinc-200 bg-white p-4">
          <Stat label="Stores" value={clientStores.length} />
          <Stat label="Employees" value={clientUsers.length} />
          <Stat label="Lessons assigned" value={assignments.length} />
          <Stat label="Allowed domains" value={domains.length} />
        </dl>
      </section>

      {assignedLessonRows.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-zinc-700 mb-2">
            Assigned lessons
          </h2>
          <ul className="rounded-md border border-zinc-200 bg-white divide-y divide-zinc-200">
            {assignedLessonRows.map((l) => (
              <li
                key={l.id}
                className="px-4 py-2 text-sm flex items-center justify-between"
              >
                <span>
                  <span className="font-medium">
                    {l.title ?? l.internalName}
                  </span>
                  {l.title && (
                    <span className="ml-2 text-xs text-zinc-500">
                      ({l.internalName})
                    </span>
                  )}
                </span>
                <Link
                  href={`/admin/lessons/${l.id}`}
                  className="text-xs text-zinc-700 hover:underline"
                >
                  Manage →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="pt-4 border-t border-zinc-200">
        <h2 className="text-sm font-medium text-red-700 mb-2">Danger zone</h2>
        <DeleteClientButton
          clientId={client.id}
          clientName={client.name}
          stats={{
            stores: clientStores.length,
            employees: clientUsers.length,
            lessons: assignments.length,
          }}
        />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="text-zinc-900 font-medium">{value}</dd>
    </div>
  );
}
