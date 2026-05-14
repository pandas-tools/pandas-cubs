# Deploy

Pandas Cubs runs on **Railway** — app + Postgres in a single project. Eventually mapped to `learn.pandas.io`.

## Railway

- **Project:** `pandas-cubs` (id `e0bf2e2d-cd72-47ab-85a8-7286d8972198`)
- **Environment:** `production` (id `f6e41437-0cd1-442e-8dd5-3d4b540930f0`)
- **Workspace:** Pandas
- **Services:**
  - `web` (id `0901b207-c20a-4cd2-9546-9c456ee3161b`) — Next.js app, public URL `https://web-production-740fa.up.railway.app`
  - `Postgres` (id `5fc74ee4-8f0c-486c-824e-8742815fa168`) — managed Postgres, exposes `DATABASE_URL` via Railway reference variables

The `web` service starts life as an `nginxdemos/hello` placeholder so the public URL exists before code does. It's swapped to the GitHub repo source once Phase 1 is committed.

## Required env vars (production)

Set these on the `web` service. Reference vars from `Postgres` come for free via `${{ Postgres.DATABASE_URL }}`.

| Var | Source | Notes |
|---|---|---|
| `DATABASE_URL` | `${{ Postgres.DATABASE_URL }}` | Railway reference variable |
| `AUTH_SECRET` | `openssl rand -base64 32` | Auth.js JWT signing secret |
| `AUTH_URL` | `https://<railway-public-url>` | Auth.js absolute callback URL |
| `AUTH_RESEND_KEY` | Resend API key | Pulled from `/personas/dex/.env:RESEND_API_KEY` |
| `AUTH_EMAIL_FROM` | `auth@mkt.pandas.io` | Verified Resend sending address |
| `MUX_TOKEN_ID` | Mux dashboard | (Mapped from local `MUX_TOKEN` in `/personas/dex/.env`) |
| `MUX_TOKEN_SECRET` | Mux dashboard | (Mapped from local `MUX_SECRET_KEY`) |
| `MUX_WEBHOOK_SECRET` | Mux webhook settings | Generated when the webhook endpoint is created in Mux |
| `NEXT_PUBLIC_SITE_URL` | `https://<railway-public-url>` | Used by client-side code |
| `ADMIN_ALLOWLIST` | `dimitris@pandas.io` (comma-separated) | Bootstrap admin emails — these always pass the domain check |

## Mux webhook

- Endpoint: `https://<railway-public-url>/api/webhooks/mux`
- Events to subscribe: `video.asset.ready`, `video.asset.errored`, `video.upload.asset_created`
- Signing secret: copy from Mux dashboard → set as `MUX_WEBHOOK_SECRET` on Railway

## DNS cutover (later)

When `learn.pandas.io` is ready:

1. Add a custom domain on the Railway `web` service.
2. Add CNAME at the DNS provider pointing `learn.pandas.io` → Railway-provided target.
3. Update `AUTH_URL` and `NEXT_PUBLIC_SITE_URL` to `https://learn.pandas.io`.
4. Add `learn.pandas.io` as a verified Resend sending domain. Update `AUTH_EMAIL_FROM` to `auth@learn.pandas.io`.
5. Update the Mux webhook URL to `https://learn.pandas.io/api/webhooks/mux`.

## Rollback

Railway keeps prior deployments. To roll back:

```
railway service:list
railway redeploy <previous-deployment-id> --service web
```

Or via the dashboard: `web` service → Deployments → choose previous → Redeploy.

## Build + release

`package.json` defines:

- `npm run build` → `next build`
- `npm run start` → `next start`
- `npm run db:migrate` → applies pending Drizzle migrations

Railway invokes `npm run build`, then `npm run start`. We add a `release` script (Railway's pre-deploy hook) to run `npm run db:migrate` before the new revision starts serving:

```jsonc
// railway.json
{
  "deploy": {
    "startCommand": "npm run db:migrate && npm run start"
  }
}
```

## Health check

`GET /api/health` returns `{ ok: true, db: 'ok' }` after pinging Postgres. Railway uses this for health probing.
