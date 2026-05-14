# Agents

Any agent (Claude, Codex, anything) starting a session in this repo: read [`CLAUDE.md`](CLAUDE.md) first, then `docs/README.md`, then the files it points to.

## What this app is

**Pandas Cubs** — internal training portal where retail employees watch short videos to learn Pandas Vision AI / platform onboarding. Backend-heavy app: auth, DB, Mux video, admin panel. Eventually served at `learn.pandas.io`.

## Stack quirks worth knowing

- **Next.js 16** + React 19 + Tailwind v4. Most LLM training data is Next 14/15 — APIs and conventions have changed. When unsure, check `node_modules/next/dist/docs/` after `npm install` rather than guessing.
- **Auth.js v5 beta** (`next-auth@5.0.0-beta.31`). The v5 API differs significantly from NextAuth v4 — config is now `auth.ts` returning `{ auth, signIn, signOut, handlers }`.
- **Drizzle ORM** for the data layer, not Prisma. Schema in `src/lib/db/schema.ts`. Migrations via `drizzle-kit`.
- **Tenant scoping happens in app code, not in Postgres.** `src/lib/db/scoped.ts` wraps queries with a `client_id` filter derived from the session. Don't bypass it for employee-facing routes.

## House rules

- Branch + preview URL before merging once we're past Phase 1. **Never** push straight to `main` after that.
- Don't `--no-verify` or `--force`.
- Update `docs/` in the same PR when you change something material.
- Don't commit `.env`. If you stage it by accident, `git reset` it before committing.
