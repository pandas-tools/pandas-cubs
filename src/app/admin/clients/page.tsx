import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  clients,
  clientAllowedDomains,
  clientLessons,
  stores,
  users,
} from "@/lib/db/schema";

export const metadata = { title: "Clients · Admin · Dojo" };
export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") notFound();

  const clientList = await db.select().from(clients).orderBy(clients.name);

  // Pull related counts in one batch
  const allDomains = await db.select().from(clientAllowedDomains);
  const allLessons = await db.select().from(clientLessons);
  const allStores = await db.select().from(stores);
  const allUsers = await db
    .select()
    .from(users)
    .where(eq(users.role, "employee"));

  const domainsByClient = group(allDomains, (d) => d.clientId);
  const lessonsByClient = group(allLessons, (l) => l.clientId);
  const storesByClient = group(allStores, (s) => s.clientId);
  const usersByClient = group(allUsers, (u) => u.clientId ?? "");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Clients</h1>
        <p className="text-sm text-zinc-600 mt-1">
          Read-only for now. Add/edit clients, domains, and languages lands in
          a later phase. Orange Belgium is seeded.
        </p>
      </div>

      <div className="space-y-4">
        {clientList.map((c) => {
          const domains = domainsByClient.get(c.id) ?? [];
          const assigned = lessonsByClient.get(c.id) ?? [];
          const storeCount = (storesByClient.get(c.id) ?? []).length;
          const userCount = (usersByClient.get(c.id) ?? []).length;
          return (
            <div
              key={c.id}
              className="rounded-md border border-zinc-200 bg-white p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium">{c.name}</h2>
                  <p className="text-xs text-zinc-500">slug: {c.slug}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.isActive
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-zinc-200 text-zinc-700"
                  }`}
                >
                  {c.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                <Stat label="Stores" value={storeCount} />
                <Stat label="Employees" value={userCount} />
                <Stat label="Lessons assigned" value={assigned.length} />
                <Stat label="Allowed domains" value={domains.length} />
              </dl>

              {domains.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">
                    Allowed domains
                  </p>
                  <ul className="flex flex-wrap gap-2 text-sm">
                    {domains.map((d) => (
                      <li
                        key={d.id}
                        className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-700"
                      >
                        {d.domain}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
        {clientList.length === 0 && (
          <p className="text-sm text-zinc-500">No clients yet.</p>
        )}
      </div>
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

function group<T, K>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = m.get(k) ?? [];
    arr.push(item);
    m.set(k, arr);
  }
  return m;
}
