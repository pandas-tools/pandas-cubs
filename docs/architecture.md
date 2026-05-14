# Architecture

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | Server Components by default |
| Language | TypeScript strict | |
| Styling | Tailwind v4 | Utility classes only; no design system yet |
| Database | Postgres (Railway managed) | `DATABASE_URL` from Railway's reference vars |
| ORM | Drizzle | Schema-first, lightweight, TS-typed |
| Auth | Auth.js v5 (`next-auth@5.0.0-beta.31+`) | Resend email provider, JWT strategy |
| Email | Resend | Sending domain: `mkt.pandas.io` (eventually `learn.pandas.io`) |
| Video | Mux | Direct upload, HLS, auto-captions via Whisper |
| Tests | Vitest | Integration tests for auth, tenant isolation, webhook |
| Deploy | Railway | Web + Postgres in one project |

## Repo layout

```
src/
├── middleware.ts              # auth + onboarding routing
├── lib/
│   ├── env.ts                 # typed env-var access
│   ├── auth.ts                # Auth.js config; exports { auth, signIn, signOut, handlers }
│   ├── mux.ts                 # Mux client + webhook verifier helpers
│   ├── domain.ts              # email-domain → client_id resolution
│   └── db/
│       ├── client.ts          # Drizzle client (postgres-js driver)
│       ├── schema.ts          # all tables in one file
│       ├── scoped.ts          # scopedDb(user) — tenant filter
│       ├── migrate.ts         # runs pending migrations on boot
│       └── seed.ts            # idempotent seed: Orange Belgium + Dimi as admin
├── app/
│   ├── layout.tsx
│   ├── page.tsx               # → /login | /browse based on auth
│   ├── login/page.tsx
│   ├── onboarding/…
│   ├── browse/page.tsx
│   ├── watch/[id]/page.tsx
│   ├── admin/…
│   └── api/
│       ├── health/route.ts
│       ├── auth/[…nextauth]/route.ts
│       ├── auth/check-domain/route.ts
│       ├── lessons/…
│       ├── user/profile/…
│       ├── webhooks/mux/route.ts
│       └── admin/…
└── tests/
    ├── tenant-isolation.test.ts
    ├── auth-domain-check.test.ts
    └── mux-webhook.test.ts
```

## Tenant scoping (the load-bearing pattern)

We don't use Postgres Row-Level Security. Every employee-facing query goes through `scopedDb(user)`, which returns a Drizzle wrapper that auto-injects `where client_id = user.client_id` on every tenant table.

```ts
// inside an API route handler
import { auth } from "@/lib/auth";
import { scopedDb } from "@/lib/db/scoped";

const session = await auth();
if (!session?.user) return new Response("unauthorized", { status: 401 });

const db = scopedDb(session.user);
const lessons = await db.lessons.list();   // already filtered by client_id
```

The wrapper rejects any attempt to read or write outside the user's tenant. Admin routes (where `role === 'admin'` and `client_id === null`) use the raw Drizzle client (`@/lib/db/client.ts`) and self-enforce authorization at the top of each handler.

## Auth

Auth.js v5 with the Resend email provider (`@auth/core/providers/resend`). The flow:

1. User submits email at `/login`.
2. Client calls `POST /api/auth/check-domain` first. Server checks:
   - Is the email's domain in `client_allowed_domains`?
   - Or is it a pre-seeded admin email?
3. If allowed → client calls `signIn("resend", { email })` (server action). Resend sends the magic link.
4. User clicks → Auth.js verifies → creates `users` row via the `events.createUser` callback (resolves `client_id` from domain, sets `role = 'employee'` or `'admin'`).
5. Middleware routes: admin → `/admin`, employee with `onboarding_completed = false` → `/onboarding`, else → `/browse`.

JWT strategy (not database sessions) — keeps the request path off Postgres, avoids a per-request DB query.

## Mux

- Admin uploads happen via direct-to-Mux POST (browser → Mux). Our server creates the upload URL (`POST /api/admin/mux/upload-url`) and returns it.
- After upload, Mux processes and fires a webhook → `POST /api/webhooks/mux`. We verify the signature with `MUX_WEBHOOK_SECRET` (HMAC-SHA256 over the raw body), then update `lesson_translations` with `mux_playback_id`, `mux_asset_id`, `duration_seconds`, `thumbnail_url`.
- Playback uses `@mux/mux-player-react` — it only needs the `playback_id`. Mux handles encoding, CDN, adaptive streaming.

## Migrations + seeds

- Schema lives in `src/lib/db/schema.ts`.
- `npm run db:generate` produces SQL migration files in `drizzle/`.
- `npm run db:migrate` applies them (runs on Railway via the `release` step).
- `npm run db:seed` is idempotent; safe to run multiple times. Seeds: Orange Belgium client + `parallel9.com` allowed domain + Dimi as admin.

## What we deliberately don't have

- No design system / shadcn / ui kit (yet)
- No client-scoped admin role (`client_admin`) — schema supports it, UI does not
- No background workers / cron — store re-confirmation is checked in middleware
- No state management library — server-driven, forms via Server Actions
- No analytics tracking / observability — Railway's built-in logs are enough for now
