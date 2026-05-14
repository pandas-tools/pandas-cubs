# pandas-cubs

Internal training portal for retail employees on Pandas Vision AI + platform. Eventually at **`learn.pandas.io`**.

## What it does

1. **Employee onboarding.** A retail employee enters their work email. If the email's domain is allowlisted for a Pandas client (e.g., Orange Belgium), they get a magic-link login.
2. **Training videos.** They go through a Reels-style flow watching short training videos (Vision AI, platform usage, etc.). Each lesson ends with a 1–5 rating.
3. **Multi-language.** Videos are available in multiple languages — dubbed via HeyGen/ElevenLabs or subtitled via Mux's Whisper auto-captions.
4. **Admin panel.** Pandas team manages clients, lessons (Mux uploads), stores, and views completion analytics per client.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind v4
- Drizzle ORM + Postgres (Railway-managed)
- Auth.js v5 with Resend (magic-link email)
- Mux for video (direct upload, HLS, auto-captions)
- Deployed: Railway

## Quick start

```bash
npm install
cp .env.example .env   # fill in values from /personas/dex/.env or 1Password
npm run db:push        # apply schema to local/Railway Postgres
npm run db:seed        # seed Orange Belgium + Dimi as admin
npm run dev            # http://localhost:3000
```

## Where things live

- `src/app/` — routes (App Router)
- `src/lib/db/` — Drizzle schema, client, scoped query helper
- `src/lib/auth.ts` — Auth.js config
- `src/lib/mux.ts` — Mux client + webhook verifier
- `src/tests/` — Vitest tests (tenant isolation, auth, webhook)
- `docs/` — architecture, decisions, deploy notes

## Project context

Read [`CLAUDE.md`](CLAUDE.md) and [`docs/README.md`](docs/README.md) before contributing. The studio plan lives at `.claude/_studio/plans/2026-05-14-cubs-build.md`.
