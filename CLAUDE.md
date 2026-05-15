# dojo

**Dojo** — the internal training portal for retail employees on Pandas Vision AI + platform. Named after the training hall. Domain (eventually): `learn.pandas.io`.

Next.js 16 (App Router) + TypeScript + Tailwind v4 + Drizzle + Auth.js v5 + Mux. Deployed to Railway.

## Read these in order before touching code

1. [`docs/README.md`](docs/README.md) — TOC
2. [`docs/spec.md`](docs/spec.md) — canonical product spec (data model, auth flow, UX, MVP scope)
3. [`docs/architecture.md`](docs/architecture.md) — stack, `src/` layout, tenant scoping pattern
4. [`docs/decisions.md`](docs/decisions.md) — running ADR for this project
5. [`docs/deploy.md`](docs/deploy.md) — Railway project, env vars, webhook setup
6. The studio plan: `.claude/_studio/plans/2026-05-14-cubs-build.md` (phases, principles, what's in/out of scope)

## Hard rules

- **App-layer tenant scoping is non-negotiable.** Every employee-facing query goes through `src/lib/db/scoped.ts → scopedDb(user)`. Never construct a query in a route handler that touches a tenant table without this wrapper. There's an integration test (`src/tests/tenant-isolation.test.ts`) that fails the build if this is bypassed.
- **Admin write routes** check `session.user.role === 'admin'` server-side, not just via middleware. Middleware redirects; it does not authorize.
- **Never commit `.env`.** Secrets live there in mode 0600. `.env.example` (committed) lists every variable name with empty values.
- **Mux webhook** must verify the signature with `MUX_WEBHOOK_SECRET` before doing anything with the payload. There's a test that proves invalid signatures are rejected.
- **Never `--no-verify`, never `--force` to main.** If a hook fails, fix the underlying issue.
- **Don't add features outside the studio plan.** The plan is ground truth. If something feels missing, propose it as an addition first, then build.

## Conventions

- Routes are thin. Logic lives in `src/lib/`. If a route handler is >50 lines, extract it.
- Server Components by default. Client Components (`"use client"`) only when interactivity is needed (forms with state, the Mux player, the rating widget).
- One thing per file. No god-files.
- Plain Tailwind utility classes. No design system yet. Forms are hand-rolled HTML. Ugly is fine while we get to MVP.
- Tests: Vitest. Cover the seams — auth flow, tenant isolation, Mux webhook signature, domain-allowlist check. Skip unit tests on glue code.

## Workflow

This repo is being built by Dex (CTO agent) autonomously through the initial phases. Once the MVP is live and Dimi joins the loop, the same branch + PR workflow used in `pandas-website` applies.

For now, while we're still scaffolding through Phase 2:
- Direct commits to `main` are acceptable for foundation work (Phase 1) since there's nothing to break yet.
- From Phase 2 onward, prefer `dex/<slug>` branches + PRs that auto-merge after `code-reviewer` clears them.
- Every phase ends with `code-reviewer` on the diff and a `chrome-devtools` smoke pass on any new UI surface.
