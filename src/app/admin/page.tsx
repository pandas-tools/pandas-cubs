import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import {
  clients,
  lessons,
  lessonCompletions,
  users,
} from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export const metadata = { title: "Admin · Dojo" };
export const dynamic = "force-dynamic";

export default async function AdminHome() {
  // Belt + suspenders — layout already redirects non-admins, but we
  // self-guard here so the page can never serve data unguarded.
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") notFound();

  const [clientList, [lessonStat], [completionStat], [userStat]] = await Promise.all([
    db.select().from(clients).orderBy(clients.name),
    db.select({ value: count() }).from(lessons),
    db.select({ value: count() }).from(lessonCompletions),
    db
      .select({ value: count() })
      .from(users)
      .where(eq(users.role, "employee")),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-zinc-600 mt-1">
          Dojo admin panel — manage clients, lessons, and content.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Clients" value={clientList.length} />
        <Stat label="Lessons" value={lessonStat.value} />
        <Stat label="Employees" value={userStat.value} />
        <Stat label="Completions" value={completionStat.value} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Clients</h2>
          <Link
            href="/admin/lessons"
            className="text-sm text-zinc-700 hover:underline"
          >
            Manage lessons →
          </Link>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white overflow-hidden">
          {clientList.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">No clients yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Slug</th>
                  <th className="px-4 py-2">Active</th>
                </tr>
              </thead>
              <tbody>
                {clientList.map((c) => (
                  <tr key={c.id} className="border-t border-zinc-200">
                    <td className="px-4 py-2 font-medium">{c.name}</td>
                    <td className="px-4 py-2 text-zinc-500">{c.slug}</td>
                    <td className="px-4 py-2">
                      {c.isActive ? "✓" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
