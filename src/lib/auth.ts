// Full Auth.js config — Node-runtime only.
//
// This is what's used by:
//   - /api/auth/[…nextauth] handler
//   - `await auth()` in Server Components and Server Actions
//   - signIn() / signOut() helpers
//
// It layers DB-backed concerns (Drizzle adapter, JWT self-heal, createUser
// events) onto the Edge-safe slice in auth.config.ts. Middleware imports
// auth.config separately so the Edge runtime never tries to load Drizzle
// or the postgres-js driver.
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { users, accounts, verificationTokens } from "./db/schema";
import { checkEmailAllowed } from "./domain";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  // Providers live ONLY in the full Node-runtime config. The slim
  // auth.config slice has providers: [] because Resend pulls Node deps
  // (the `resend` SDK) that don't run in Edge middleware.
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.AUTH_EMAIL_FROM,
    }),
  ],
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    verificationTokensTable: verificationTokens,
  }),
  events: {
    async createUser({ user }) {
      // Resolve client_id from email domain on first sign-in.
      // Admins get role='admin', client_id=null.
      // Employees get role='employee', client_id from the allowed-domain match.
      if (!user.email) return;
      const result = await checkEmailAllowed(user.email);
      if (result.kind === "admin") {
        await db
          .update(users)
          .set({ role: "admin", clientId: null })
          .where(eq(users.id, user.id!));
      } else if (result.kind === "employee") {
        await db
          .update(users)
          .set({ role: "employee", clientId: result.clientId })
          .where(eq(users.id, user.id!));
      }
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user.email) return false;
      const result = await checkEmailAllowed(user.email);
      return result.kind !== "rejected";
    },
    async jwt({ token, user, trigger }) {
      // Refresh user fields from DB on:
      //   - sign-in (user is set)
      //   - explicit unstable_update() call (trigger === 'update')
      //   - any request where the JWT is missing/stale (no role yet, or
      //     onboarding still false)
      const needsRefresh =
        !!user?.id ||
        trigger === "update" ||
        token.onboardingCompleted !== true ||
        token.role === undefined;
      if (!needsRefresh) return token;

      const id = (user?.id ?? token.sub) as string | undefined;
      if (!id) return token;

      const [row] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      if (!row) return token;

      // Self-heal: `events.createUser` is fire-and-forget in Auth.js v5,
      // so on the very first sign-in the JWT callback may run before that
      // event sets role/client_id. Re-derive them from the email here
      // (idempotent — same logic as events.createUser) so we never serve
      // a "employee with null client_id" or a missed-admin token.
      let role = row.role;
      let clientId = row.clientId;
      if (row.email) {
        const allowed = await checkEmailAllowed(row.email);
        if (allowed.kind === "admin" && (role !== "admin" || clientId !== null)) {
          role = "admin";
          clientId = null;
          await db
            .update(users)
            .set({ role, clientId, updatedAt: new Date() })
            .where(eq(users.id, row.id));
        } else if (
          allowed.kind === "employee" &&
          (role !== "employee" || clientId !== allowed.clientId)
        ) {
          role = "employee";
          clientId = allowed.clientId;
          await db
            .update(users)
            .set({ role, clientId, updatedAt: new Date() })
            .where(eq(users.id, row.id));
        }
      }

      token.uid = row.id;
      token.role = role;
      token.clientId = clientId;
      token.onboardingCompleted = row.onboardingCompleted;
      token.preferredLanguage = row.preferredLanguage;
      token.storeId = row.storeId;
      return token;
    },
  },
});
