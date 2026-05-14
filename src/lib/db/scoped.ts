/**
 * scopedDb(user) — tenant-isolation wrapper around the Drizzle client.
 *
 * Every employee-facing query must go through this wrapper. It auto-injects
 * `where client_id = user.clientId` on every tenant-scoped read and refuses
 * to act if the user has no clientId (admins should use the raw `db` client
 * with explicit authorization checks).
 *
 * Phase 1 stub — the full implementation lands in Phase 2 alongside the
 * employee API routes. Integration test `src/tests/tenant-isolation.test.ts`
 * (also Phase 2) is the contract.
 */

import { eq, and, inArray } from "drizzle-orm";
import { db } from "./client";
import {
  clientLessons,
  lessons,
  lessonTranslations,
  lessonCompletions,
  stores,
  clients,
  clientLanguages,
} from "./schema";

export type ScopedUser = {
  id: string;
  clientId: string;
  role: "employee" | "admin" | "client_admin";
};

export function scopedDb(user: ScopedUser) {
  if (!user.clientId) {
    throw new Error("scopedDb requires a clientId");
  }
  const cid = user.clientId;

  return {
    raw: db, // escape hatch; usage outside this module = code review block
    cid,

    client: {
      get: () =>
        db.query.clients.findFirst({
          where: eq(clients.id, cid),
        }),
    },

    languages: {
      list: () =>
        db.query.clientLanguages.findMany({
          where: eq(clientLanguages.clientId, cid),
        }),
    },

    stores: {
      list: () =>
        db.query.stores.findMany({
          where: and(eq(stores.clientId, cid), eq(stores.isActive, true)),
        }),
    },

    lessons: {
      // List published lessons assigned to this client
      list: async () => {
        const assignments = await db
          .select({ lessonId: clientLessons.lessonId })
          .from(clientLessons)
          .where(eq(clientLessons.clientId, cid));
        const ids = assignments.map((a) => a.lessonId);
        if (ids.length === 0) return [];
        return db.query.lessons.findMany({
          where: and(inArray(lessons.id, ids), eq(lessons.isPublished, true)),
          orderBy: (l, { asc }) => [asc(l.sortOrder)],
        });
      },
      // Verify a lesson belongs to this client before returning
      getById: async (lessonId: string) => {
        const [assignment] = await db
          .select()
          .from(clientLessons)
          .where(
            and(
              eq(clientLessons.clientId, cid),
              eq(clientLessons.lessonId, lessonId),
            ),
          );
        if (!assignment) return null;
        return db.query.lessons.findFirst({
          where: and(eq(lessons.id, lessonId), eq(lessons.isPublished, true)),
        });
      },
    },

    translations: {
      // Get translation for a lesson in a preferred language, with English fallback
      forLesson: async (lessonId: string, preferred: string) => {
        // Check the lesson is assigned to this client
        const [assignment] = await db
          .select()
          .from(clientLessons)
          .where(
            and(
              eq(clientLessons.clientId, cid),
              eq(clientLessons.lessonId, lessonId),
            ),
          );
        if (!assignment) return null;

        const all = await db.query.lessonTranslations.findMany({
          where: eq(lessonTranslations.lessonId, lessonId),
        });
        const inPreferred = all.find((t) => t.language === preferred);
        if (inPreferred) return inPreferred;
        return all.find((t) => t.language === "en") ?? null;
      },
    },

    completions: {
      forUser: () =>
        db.query.lessonCompletions.findMany({
          where: eq(lessonCompletions.userId, user.id),
        }),
      upsert: async (lessonId: string, rating: number) => {
        // Verify lesson is assigned to user's client first
        const [assignment] = await db
          .select()
          .from(clientLessons)
          .where(
            and(
              eq(clientLessons.clientId, cid),
              eq(clientLessons.lessonId, lessonId),
            ),
          );
        if (!assignment) {
          throw new Error("Lesson not assigned to user's client");
        }
        if (rating < 1 || rating > 5) {
          throw new Error("Rating must be between 1 and 5");
        }
        return db
          .insert(lessonCompletions)
          .values({
            userId: user.id,
            lessonId,
            rating,
          })
          .onConflictDoUpdate({
            target: [lessonCompletions.userId, lessonCompletions.lessonId],
            set: { rating, completedAt: new Date() },
          })
          .returning();
      },
    },
  };
}
