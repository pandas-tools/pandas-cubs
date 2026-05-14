# Decisions

Running ADR for `pandas-cubs`. New decisions go at the top with a date and status. See also `.claude/_studio/decisions/` for cross-project decisions (the stack-pivot rationale lives there).

---

## 2026-05-14 — Postgres on Railway, no Row-Level Security

**Status:** Decided.

**Decision:** Postgres lives on Railway as a managed service. RLS is not used. Tenant isolation is enforced in the app layer via a `scopedDb(user)` query helper.

**Why:** The original spec (with Supabase) leaned on RLS because the database was the trust boundary for many independent clients (Supabase SDK, dashboard, edge functions). Here we have one Next.js app talking to Postgres. A single query helper + integration tests is simpler than parallel SQL policy files and gives us the same guarantee. Also: Postgres on Railway is just Postgres — no vendor lock-in on the data plane.

**Trade-off:** If we ever add another service that hits the DB directly (e.g., a background worker not written in this repo), it must also use the helper or write its own scoping. We add a CI test that proves cross-tenant reads are rejected.

---

## 2026-05-14 — Auth.js v5 + Resend (magic link)

**Status:** Decided.

**Decision:** Use `next-auth@5.0.0-beta.31+` with the Resend email provider. JWT strategy.

**Why:** Auth.js v5 is the idiomatic auth library for Next.js. The Resend provider is first-class. JWT (over DB sessions) keeps the hot path off Postgres. Drizzle adapter handles user/account/verification-token tables.

**Trade-off:** We're on a beta. Pin the version and watch for breaking changes between betas. The v5 API has stabilized enough by beta.31 to be safe.

---

## 2026-05-14 — Drizzle, not Prisma

**Status:** Decided.

**Decision:** Drizzle ORM for schema, migrations, and queries.

**Why:** Drizzle is closer to raw SQL than Prisma — easier to reason about, lighter runtime, and the migration story is plain SQL files (which we can hand-edit if needed). Prisma's generated client + schema language is a heavier abstraction for a project where most queries are tenant-scoped variations of `select … where client_id = $1`.

**Trade-off:** Smaller ecosystem of GUI tools. `drizzle-kit studio` covers our needs.

---

## 2026-05-14 — No shadcn/ui yet

**Status:** Decided (revisit after MVP ships).

**Decision:** Plain Tailwind utility classes, hand-rolled HTML forms, no component library in Phase 1–4.

**Why:** Per Dimi's directive ("functional, ugly, end-to-end usable; we polish later"), we ship the vertical slice without a design system. A component library reflexively introduced before we know what we need ends up shaping decisions rather than serving them.

**Trade-off:** UI will look unfinished. Acceptable for internal training portal. When we polish, we re-evaluate (shadcn/ui vs. mantine vs. hand-rolled with design tokens).
