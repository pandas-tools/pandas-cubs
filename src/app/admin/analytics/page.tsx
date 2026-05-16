import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getClientAnalytics, type ClientAnalytics } from "@/lib/analytics";

export const metadata = { title: "Analytics · Admin · Dojo" };
export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") notFound();

  const data = await getClientAnalytics();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-zinc-600 mt-1">
          Training rollout health, per client. Refresh the page for the latest
          numbers — no caching, no aggregation tables.
        </p>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No clients yet. Add one in <Link href="/admin/clients" className="underline">Clients</Link>.
        </p>
      ) : (
        <div className="space-y-4">
          {data.map((c) => (
            <ClientCard key={c.clientId} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClientCard({ c }: { c: ClientAnalytics }) {
  const storeActivationPct =
    c.storeCount > 0 ? Math.round((c.activeStoreCount / c.storeCount) * 100) : 0;
  const trainedPct =
    c.employeeCount > 0
      ? Math.round((c.trainedEmployeeCount / c.employeeCount) * 100)
      : 0;

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-medium">{c.name}</h2>
          <p className="text-xs text-zinc-500">
            {c.assignedLessonCount} lesson
            {c.assignedLessonCount === 1 ? "" : "s"} assigned
          </p>
        </div>
        <Link
          href={`/admin/analytics/${c.clientId}`}
          className="text-sm text-zinc-700 hover:underline"
        >
          Detail →
        </Link>
      </div>

      <dl className="grid gap-6 sm:grid-cols-3">
        <Metric
          label="Store activation"
          big={`${c.activeStoreCount} / ${c.storeCount}`}
          sub={
            c.storeCount > 0
              ? `${storeActivationPct}% have training activity`
              : "No stores configured"
          }
          bar={c.storeCount > 0 ? c.activeStoreCount / c.storeCount : 0}
          empty={c.storeCount === 0}
        />
        <Metric
          label="Trained employees"
          big={`${c.trainedEmployeeCount} / ${c.employeeCount}`}
          sub={
            c.assignedLessonCount === 0
              ? "No lessons assigned yet"
              : c.employeeCount === 0
                ? "No employees yet"
                : c.avgTrainedPerActiveStore !== null
                  ? `${c.avgTrainedPerActiveStore} per active store · ${trainedPct}% overall`
                  : `${trainedPct}% overall`
          }
          bar={c.employeeCount > 0 ? c.trainedEmployeeCount / c.employeeCount : 0}
          empty={c.employeeCount === 0 || c.assignedLessonCount === 0}
        />
        <Metric
          label="Average rating"
          big={c.avgRating !== null ? `${c.avgRating} / 5` : "—"}
          sub={
            c.responseCount > 0
              ? `from ${c.responseCount} response${c.responseCount === 1 ? "" : "s"}`
              : "No ratings yet"
          }
          bar={c.avgRating !== null ? c.avgRating / 5 : 0}
          empty={c.avgRating === null}
        />
      </dl>
    </div>
  );
}

function Metric({
  label,
  big,
  sub,
  bar,
  empty,
}: {
  label: string;
  big: string;
  sub: string;
  bar: number;
  empty?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, bar)) * 100;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold text-zinc-900">{big}</dd>
      <p className="mt-1 text-xs text-zinc-600">{sub}</p>
      <div className="mt-2 h-1 w-full rounded-full bg-zinc-100">
        <div
          className={`h-1 rounded-full transition-all ${
            empty ? "bg-zinc-300" : "bg-emerald-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
