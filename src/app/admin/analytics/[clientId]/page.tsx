import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getClientDetailAnalytics,
  type FunnelStage,
  type StoreRow,
  type LessonRow,
  type EmployeeRow,
} from "@/lib/analytics-detail";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const data = await getClientDetailAnalytics(clientId);
  return {
    title: `${data?.clientName ?? "Client"} · Analytics · Dojo`,
  };
}

export default async function ClientDetailAnalyticsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") notFound();

  const { clientId } = await params;
  const data = await getClientDetailAnalytics(clientId);
  if (!data) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/analytics"
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← All clients
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{data.clientName}</h1>
        <p className="text-sm text-zinc-600">
          {data.totals.storeCount} store{data.totals.storeCount === 1 ? "" : "s"}
          {" · "}
          {data.totals.employeeCount} employee
          {data.totals.employeeCount === 1 ? "" : "s"} {" · "}
          {data.totals.assignedLessonCount} lesson
          {data.totals.assignedLessonCount === 1 ? "" : "s"} assigned
        </p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-zinc-700 mb-3">
          Training funnel
        </h2>
        <Funnel funnel={data.funnel} />
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-700 mb-3">Stores</h2>
        <StoresTable rows={data.stores} />
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-700 mb-3">
          Lesson breakdown
        </h2>
        <LessonsTable rows={data.lessons} />
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-700 mb-3">Employees</h2>
        <EmployeesTable rows={data.employees} />
      </section>
    </div>
  );
}

function Funnel({ funnel }: { funnel: FunnelStage[] }) {
  const maxCount = Math.max(1, ...funnel.map((f) => f.count));
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4 space-y-3">
      {funnel.map((stage, i) => {
        const widthPct = (stage.count / maxCount) * 100;
        const dropFromPrev =
          i > 0 ? funnel[i - 1].count - stage.count : null;
        return (
          <div key={stage.label}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-zinc-800">{stage.label}</span>
              <span className="text-zinc-600">
                {stage.count}
                {i > 0 && (
                  <>
                    <span className="mx-1 text-zinc-400">·</span>
                    <span className="text-xs text-zinc-500">
                      {(stage.rate * 100).toFixed(0)}% conversion
                      {dropFromPrev !== null && dropFromPrev > 0 && (
                        <> · {dropFromPrev} drop-off</>
                      )}
                    </span>
                  </>
                )}
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-zinc-100">
              <div
                className="h-3 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StoresTable({ rows }: { rows: StoreRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500 rounded-md border border-zinc-200 bg-white p-4">
        No stores configured.
      </p>
    );
  }
  return (
    <div className="rounded-md border border-zinc-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-2">Store</th>
            <th className="px-3 py-2">City</th>
            <th className="px-3 py-2 text-right">Employees</th>
            <th className="px-3 py-2 text-right">Completed all</th>
            <th className="px-3 py-2 text-right">Completion %</th>
            <th className="px-3 py-2 text-right">Avg rating</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.storeId} className="border-t border-zinc-200">
              <td className="px-3 py-2 font-medium">{r.name}</td>
              <td className="px-3 py-2 text-zinc-600">{r.city ?? "—"}</td>
              <td className="px-3 py-2 text-right">{r.employeesLoggedIn}</td>
              <td className="px-3 py-2 text-right">{r.completedAll}</td>
              <td className="px-3 py-2 text-right">
                {r.employeesLoggedIn > 0
                  ? `${Math.round(r.completionPct * 100)}%`
                  : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                {r.avgRating !== null
                  ? `${r.avgRating} (${r.ratingCount})`
                  : "—"}
              </td>
              <td className="px-3 py-2">
                <StatusPill status={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: StoreRow["status"] }) {
  const map = {
    "on-track": { label: "On track", cls: "bg-emerald-100 text-emerald-800" },
    "low-completion": {
      label: "Low completion",
      cls: "bg-amber-100 text-amber-800",
    },
    "no-activity": {
      label: "No activity",
      cls: "bg-zinc-200 text-zinc-700",
    },
    "no-data": {
      label: "No lessons assigned",
      cls: "bg-zinc-100 text-zinc-600",
    },
  } as const;
  const m = map[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}

function LessonsTable({ rows }: { rows: LessonRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500 rounded-md border border-zinc-200 bg-white p-4">
        No lessons assigned to this client.
      </p>
    );
  }
  return (
    <div className="rounded-md border border-zinc-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-2">Lesson</th>
            <th className="px-3 py-2 text-right">Completions</th>
            <th className="px-3 py-2 text-right">Completion %</th>
            <th className="px-3 py-2 text-right">Avg rating</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.lessonId} className="border-t border-zinc-200">
              <td className="px-3 py-2">
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-zinc-500 font-mono">
                  {r.internalName}
                </div>
              </td>
              <td className="px-3 py-2 text-right">{r.completionCount}</td>
              <td className="px-3 py-2 text-right">
                {Math.round(r.completionPct * 100)}%
              </td>
              <td className="px-3 py-2 text-right">
                {r.avgRating !== null
                  ? `${r.avgRating} (${r.ratingCount})`
                  : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                <Link
                  href={`/admin/lessons/${r.lessonId}`}
                  className="text-xs text-zinc-700 hover:underline"
                >
                  Manage →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmployeesTable({ rows }: { rows: EmployeeRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500 rounded-md border border-zinc-200 bg-white p-4">
        No employees signed up yet.
      </p>
    );
  }
  return (
    <div className="rounded-md border border-zinc-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Store</th>
            <th className="px-3 py-2 text-right">Progress</th>
            <th className="px-3 py-2">Last active</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.userId} className="border-t border-zinc-200">
              <td className="px-3 py-2 font-mono text-xs">{r.email}</td>
              <td className="px-3 py-2 text-zinc-600">{r.storeName ?? "—"}</td>
              <td className="px-3 py-2 text-right">
                {r.completedCount} / {r.assignedCount}
              </td>
              <td className="px-3 py-2 text-zinc-600">
                {r.lastActiveAt ? formatRelative(r.lastActiveAt) : "Never"}
              </td>
              <td className="px-3 py-2">
                <EmployeeStatusPill status={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmployeeStatusPill({ status }: { status: EmployeeRow["status"] }) {
  const map = {
    "not-started": {
      label: "Not started",
      cls: "bg-zinc-200 text-zinc-700",
    },
    "in-progress": {
      label: "In progress",
      cls: "bg-amber-100 text-amber-800",
    },
    completed: {
      label: "Completed",
      cls: "bg-emerald-100 text-emerald-800",
    },
  } as const;
  const m = map[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.round((now - then) / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  return `${mo}mo ago`;
}
