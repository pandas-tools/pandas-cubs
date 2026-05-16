// Per-client analytics detail. Funnel + store table + lesson breakdown +
// employee list. All from the same in-memory aggregation pass; one query
// per source table.

import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db/client";
import {
  clients,
  stores,
  users,
  clientLessons,
  lessons,
  lessonTranslations,
  lessonCompletions,
} from "./db/schema";

export type FunnelStage = {
  label: string;
  count: number;
  // Conversion rate from the previous stage (1.0 for the first stage)
  rate: number;
};

export type StoreRow = {
  storeId: string;
  name: string;
  city: string | null;
  employeesLoggedIn: number;
  completedAll: number;
  completionPct: number; // 0..1
  avgRating: number | null;
  ratingCount: number;
  status: "no-activity" | "low-completion" | "on-track" | "no-data";
};

export type LessonRow = {
  lessonId: string;
  internalName: string;
  title: string;
  completionCount: number;
  completionPct: number; // 0..1
  avgRating: number | null;
  ratingCount: number;
};

export type EmployeeRow = {
  userId: string;
  email: string;
  storeName: string | null;
  completedCount: number;
  assignedCount: number;
  lastActiveAt: string | null; // ISO
  status: "not-started" | "in-progress" | "completed";
};

export type ClientDetailAnalytics = {
  clientId: string;
  clientName: string;
  clientSlug: string;
  totals: {
    storeCount: number;
    employeeCount: number;
    assignedLessonCount: number;
  };
  funnel: FunnelStage[];
  stores: StoreRow[];
  lessons: LessonRow[];
  employees: EmployeeRow[];
};

export async function getClientDetailAnalytics(
  clientId: string,
): Promise<ClientDetailAnalytics | null> {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!client) return null;

  const [storeRows, employeeRows, clientLessonRows] = await Promise.all([
    db.select().from(stores).where(eq(stores.clientId, clientId)),
    db
      .select()
      .from(users)
      .where(and(eq(users.role, "employee"), eq(users.clientId, clientId))),
    db.select().from(clientLessons).where(eq(clientLessons.clientId, clientId)),
  ]);

  const assignedLessonIds = clientLessonRows.map((cl) => cl.lessonId);
  const [lessonRows, translationRows, completionRows] = await Promise.all([
    assignedLessonIds.length > 0
      ? db.query.lessons.findMany({
          where: (l, { inArray: inArr }) => inArr(l.id, assignedLessonIds),
          orderBy: (l, { asc }) => [asc(l.sortOrder)],
        })
      : Promise.resolve([] as (typeof lessons.$inferSelect)[]),
    assignedLessonIds.length > 0
      ? db
          .select()
          .from(lessonTranslations)
          .where(inArray(lessonTranslations.lessonId, assignedLessonIds))
      : Promise.resolve([] as (typeof lessonTranslations.$inferSelect)[]),
    employeeRows.length > 0
      ? db
          .select()
          .from(lessonCompletions)
          .where(
            inArray(
              lessonCompletions.userId,
              employeeRows.map((u) => u.id),
            ),
          )
      : Promise.resolve([] as (typeof lessonCompletions.$inferSelect)[]),
  ]);

  const assignedCount = assignedLessonIds.length;
  const enTitleByLessonId = new Map<string, string>();
  for (const t of translationRows) {
    if (t.language === "en") enTitleByLessonId.set(t.lessonId, t.title);
  }

  // Indexed completions
  const completionsByUser = new Map<string, typeof completionRows>();
  for (const c of completionRows) {
    const arr = completionsByUser.get(c.userId) ?? [];
    arr.push(c);
    completionsByUser.set(c.userId, arr);
  }
  const completionsByLesson = new Map<string, typeof completionRows>();
  for (const c of completionRows) {
    const arr = completionsByLesson.get(c.lessonId) ?? [];
    arr.push(c);
    completionsByLesson.set(c.lessonId, arr);
  }

  // FUNNEL
  const loggedIn = employeeRows.length;
  const completed1Plus = employeeRows.filter(
    (u) => (completionsByUser.get(u.id)?.length ?? 0) > 0,
  ).length;
  const completedAll =
    assignedCount > 0
      ? employeeRows.filter(
          (u) => (completionsByUser.get(u.id)?.length ?? 0) >= assignedCount,
        ).length
      : 0;

  const funnel: FunnelStage[] = [
    { label: "Logged in", count: loggedIn, rate: 1 },
    {
      label: "Completed 1+ lessons",
      count: completed1Plus,
      rate: loggedIn > 0 ? completed1Plus / loggedIn : 0,
    },
    {
      label: "Completed all lessons",
      count: completedAll,
      rate: completed1Plus > 0 ? completedAll / completed1Plus : 0,
    },
  ];

  // STORES
  const storesById = new Map(storeRows.map((s) => [s.id, s]));
  const employeesByStore = new Map<string, typeof employeeRows>();
  for (const u of employeeRows) {
    if (!u.storeId) continue;
    const arr = employeesByStore.get(u.storeId) ?? [];
    arr.push(u);
    employeesByStore.set(u.storeId, arr);
  }

  const storeRowsOut: StoreRow[] = storeRows
    .map((s): StoreRow => {
      const usersAtStore = employeesByStore.get(s.id) ?? [];
      const loggedAtStore = usersAtStore.length;
      const completedAtStore = usersAtStore.filter(
        (u) =>
          assignedCount > 0 &&
          (completionsByUser.get(u.id)?.length ?? 0) >= assignedCount,
      ).length;
      const completionPct =
        loggedAtStore > 0 && assignedCount > 0
          ? completedAtStore / loggedAtStore
          : 0;
      const ratings = usersAtStore
        .flatMap((u) => completionsByUser.get(u.id) ?? [])
        .map((c) => c.rating);
      const avgRating =
        ratings.length > 0
          ? Number(
              (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2),
            )
          : null;

      let status: StoreRow["status"];
      if (loggedAtStore === 0) status = "no-activity";
      else if (assignedCount === 0) status = "no-data";
      else if (completionPct < 0.5) status = "low-completion";
      else status = "on-track";

      return {
        storeId: s.id,
        name: s.name,
        city: s.city,
        employeesLoggedIn: loggedAtStore,
        completedAll: completedAtStore,
        completionPct,
        avgRating,
        ratingCount: ratings.length,
        status,
      };
    })
    .sort((a, b) => {
      // Sort: on-track desc by completion, then low-completion, then no-activity
      const order = { "on-track": 0, "low-completion": 1, "no-data": 2, "no-activity": 3 };
      if (order[a.status] !== order[b.status]) {
        return order[a.status] - order[b.status];
      }
      return b.completionPct - a.completionPct;
    });

  // LESSONS
  const lessonRowsOut: LessonRow[] = lessonRows.map((l): LessonRow => {
    const lessonComps = completionsByLesson.get(l.id) ?? [];
    const completionPct =
      loggedIn > 0 ? lessonComps.length / loggedIn : 0;
    const ratings = lessonComps.map((c) => c.rating);
    const avgRating =
      ratings.length > 0
        ? Number(
            (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2),
          )
        : null;
    return {
      lessonId: l.id,
      internalName: l.internalName,
      title: enTitleByLessonId.get(l.id) ?? l.internalName,
      completionCount: lessonComps.length,
      completionPct,
      avgRating,
      ratingCount: ratings.length,
    };
  });

  // EMPLOYEES
  const employeeRowsOut: EmployeeRow[] = employeeRows
    .map((u): EmployeeRow => {
      const comps = completionsByUser.get(u.id) ?? [];
      const completedCount = comps.length;
      const lastActiveAt =
        comps.length > 0
          ? comps
              .map((c) => c.completedAt.toISOString())
              .sort()
              .reverse()[0]
          : null;
      let status: EmployeeRow["status"];
      if (completedCount === 0) status = "not-started";
      else if (assignedCount > 0 && completedCount >= assignedCount)
        status = "completed";
      else status = "in-progress";
      return {
        userId: u.id,
        email: u.email,
        storeName: u.storeId
          ? (storesById.get(u.storeId)?.name ?? null)
          : null,
        completedCount,
        assignedCount,
        lastActiveAt,
        status,
      };
    })
    .sort((a, b) => {
      // Most recently active first, then email asc for ties
      if (a.lastActiveAt && b.lastActiveAt) {
        return b.lastActiveAt.localeCompare(a.lastActiveAt);
      }
      if (a.lastActiveAt) return -1;
      if (b.lastActiveAt) return 1;
      return a.email.localeCompare(b.email);
    });

  return {
    clientId: client.id,
    clientName: client.name,
    clientSlug: client.slug,
    totals: {
      storeCount: storeRows.length,
      employeeCount: employeeRows.length,
      assignedLessonCount: assignedCount,
    },
    funnel,
    stores: storeRowsOut,
    lessons: lessonRowsOut,
    employees: employeeRowsOut,
  };
}
