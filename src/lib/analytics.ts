// Pure analytics aggregation. No HTTP, no Auth.
// Called from /api/admin/analytics + /admin/analytics page.
// Single-pass over the raw rows so we never N+1 the DB.

import { eq } from "drizzle-orm";
import { db } from "./db/client";
import {
  clients,
  stores,
  users,
  clientLessons,
  lessonCompletions,
} from "./db/schema";

export type ClientAnalytics = {
  clientId: string;
  name: string;
  slug: string;
  isActive: boolean;
  // Stores
  storeCount: number;
  activeStoreCount: number; // stores with ≥1 employee who has ≥1 completion
  // Employees
  employeeCount: number;
  trainedEmployeeCount: number; // employees who completed ALL assigned lessons
  // Per-active-store training density
  avgTrainedPerActiveStore: number | null;
  // Lessons + completions
  assignedLessonCount: number;
  completionCount: number;
  // Ratings
  avgRating: number | null;
  responseCount: number;
};

export async function getClientAnalytics(): Promise<ClientAnalytics[]> {
  const [clientRows, storeRows, employeeRows, clientLessonRows, completionRows] =
    await Promise.all([
      db.select().from(clients),
      db.select().from(stores),
      db.select().from(users).where(eq(users.role, "employee")),
      db.select().from(clientLessons),
      db.select().from(lessonCompletions),
    ]);

  // Index rows by clientId for O(1) lookups
  const storesByClient = group(storeRows, (s) => s.clientId);
  const employeesByClient = group(employeeRows, (u) => u.clientId ?? "");
  const lessonsByClient = group(clientLessonRows, (cl) => cl.clientId);

  // Map: userId → number of completions (across all lessons)
  const completionsByUser = new Map<string, number>();
  const ratingsByClient = new Map<string, number[]>();
  const completedUserIdsByClient = new Map<string, Set<string>>();
  // We need userId → clientId to attribute completions to clients
  const userToClient = new Map<string, string>();
  for (const u of employeeRows) {
    if (u.clientId) userToClient.set(u.id, u.clientId);
  }
  for (const c of completionRows) {
    completionsByUser.set(c.userId, (completionsByUser.get(c.userId) ?? 0) + 1);
    const cid = userToClient.get(c.userId);
    if (cid) {
      const ratings = ratingsByClient.get(cid) ?? [];
      ratings.push(c.rating);
      ratingsByClient.set(cid, ratings);

      const completedSet = completedUserIdsByClient.get(cid) ?? new Set<string>();
      completedSet.add(c.userId);
      completedUserIdsByClient.set(cid, completedSet);
    }
  }

  return clientRows.map((c): ClientAnalytics => {
    const clientStores = storesByClient.get(c.id) ?? [];
    const clientEmployees = employeesByClient.get(c.id) ?? [];
    const clientAssigned = (lessonsByClient.get(c.id) ?? []).length;
    const ratings = ratingsByClient.get(c.id) ?? [];
    const completedSet = completedUserIdsByClient.get(c.id) ?? new Set();

    // Active stores: any store with at least one employee who has at least one completion
    const activeStores = new Set<string>();
    for (const u of clientEmployees) {
      if (u.storeId && completedSet.has(u.id)) {
        activeStores.add(u.storeId);
      }
    }

    // Trained employees: completed ALL assigned lessons
    let trainedEmployeeCount = 0;
    if (clientAssigned > 0) {
      for (const u of clientEmployees) {
        if ((completionsByUser.get(u.id) ?? 0) >= clientAssigned) {
          trainedEmployeeCount++;
        }
      }
    }

    const totalRating = ratings.reduce((a, b) => a + b, 0);
    const avgRating = ratings.length > 0 ? totalRating / ratings.length : null;

    return {
      clientId: c.id,
      name: c.name,
      slug: c.slug,
      isActive: c.isActive,
      storeCount: clientStores.length,
      activeStoreCount: activeStores.size,
      employeeCount: clientEmployees.length,
      trainedEmployeeCount,
      avgTrainedPerActiveStore:
        activeStores.size > 0
          ? Number((trainedEmployeeCount / activeStores.size).toFixed(2))
          : null,
      assignedLessonCount: clientAssigned,
      completionCount: ratings.length, // ratings array length == completions count
      avgRating: avgRating !== null ? Number(avgRating.toFixed(2)) : null,
      responseCount: ratings.length,
    };
  });
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
