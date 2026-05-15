// Edge-safe Auth.js config slice — no database adapter, no DB-touching
// callbacks. Used by middleware (which runs in Edge runtime).
//
// The full config (auth.ts) imports this and layers on the Drizzle
// adapter, JWT self-heal, and createUser events — all of which need
// Node-runtime database access.
import type { NextAuthConfig } from "next-auth";
import Resend from "next-auth/providers/resend";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "employee" | "admin" | "client_admin";
      clientId: string | null;
      onboardingCompleted: boolean;
      preferredLanguage: string;
      storeId: string | null;
    } & import("next-auth").DefaultSession["user"];
  }
}

export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
    error: "/login",
  },
  providers: [
    // Provider list only — middleware doesn't actually invoke providers,
    // but `auth()` config requires at least one to compile.
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.AUTH_EMAIL_FROM,
    }),
  ],
  callbacks: {
    // Edge-safe: only read claims from the existing token. No DB access.
    // The Node-runtime auth.ts handler does the actual refresh + self-heal.
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
};
