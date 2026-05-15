import NextAuth, { type DefaultSession } from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { users, accounts, verificationTokens } from "./db/schema";
import { checkEmailAllowed } from "./domain";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "employee" | "admin" | "client_admin";
      clientId: string | null;
      onboardingCompleted: boolean;
      preferredLanguage: string;
      storeId: string | null;
    } & DefaultSession["user"];
  }
}

// Read env directly (process.env) — avoid env() validator at module top so
// edge-runtime middleware doesn't trip on missing vars. The validator is
// only used in Node-runtime API routes that need stricter checks.
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
    error: "/login",
  },
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.AUTH_EMAIL_FROM,
    }),
  ],
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
      // "rejected" should never reach here — signIn() is blocked before sending the magic link
    },
  },
  callbacks: {
    async signIn({ user }) {
      // Belt + suspenders. The /api/auth/check-domain endpoint already vets
      // the email client-side, but we also enforce server-side at Auth.js level.
      if (!user.email) return false;
      const result = await checkEmailAllowed(user.email);
      return result.kind !== "rejected";
    },
    async jwt({ token, user, trigger }) {
      // Refresh user fields from DB on:
      //   - sign-in (user is set)
      //   - explicit unstable_update() call (trigger === 'update')
      //   - any request where onboardingCompleted is still false (so post-
      //     onboarding redirects work without a sign-out / sign-in cycle)
      const needsRefresh =
        !!user?.id ||
        trigger === "update" ||
        token.onboardingCompleted !== true;
      if (needsRefresh) {
        const id = (user?.id ?? token.sub) as string | undefined;
        if (id) {
          const [row] = await db
            .select()
            .from(users)
            .where(eq(users.id, id))
            .limit(1);
          if (row) {
            token.uid = row.id;
            token.role = row.role;
            token.clientId = row.clientId;
            token.onboardingCompleted = row.onboardingCompleted;
            token.preferredLanguage = row.preferredLanguage;
            token.storeId = row.storeId;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        session.user.id = token.uid as string;
        session.user.role = (token.role as "employee" | "admin") ?? "employee";
        session.user.clientId = (token.clientId as string | null) ?? null;
        session.user.onboardingCompleted =
          (token.onboardingCompleted as boolean) ?? false;
        session.user.preferredLanguage =
          (token.preferredLanguage as string) ?? "en";
        session.user.storeId = (token.storeId as string | null) ?? null;
      }
      return session;
    },
  },
});
