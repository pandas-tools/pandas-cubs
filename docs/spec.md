# Pandas Training Portal — Technical Design Spec

**Date:** 2026-04-10
**Status:** Approved
**Authors:** Dimitris Lampidis, Ted (Claude)

---

## 1. Purpose

Pandas deploys Vision AI technology to telecom operators and tech retailers across hundreds of retail locations simultaneously. A major operational challenge is training retail employees at scale — there's no capacity for in-person training, and employees are busy. The Training Portal is a standalone web app where employees watch short training videos, learn the platform, and Pandas tracks who's trained and who isn't. Better trained employees means better platform adoption and better results for the client.

The platform is designed as a Pandas-internal product first, with the architecture to support becoming a standalone product later.

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js (App Router) + TypeScript | Server Components by default, Client Components where interactivity is needed |
| Hosting | Vercel (Pro plan) | Edge middleware, serverless functions |
| Database + Auth | Supabase (free tier → Pro when shipping to first client) | Postgres, Row-Level Security, magic link auth |
| Video | Mux | Adaptive streaming (HLS), auto-captions, direct upload |
| Styling | TBD (frontend phase) | To be decided when frontend work begins |

### Cost Profile

| Phase | Stack | Monthly Cost |
|-------|-------|-------------|
| Building & testing | Vercel Pro + Supabase Free + Mux Free | ~$20 (existing Vercel plan) |
| Production (first client) | Vercel Pro + Supabase Pro + Mux Free | ~$45 |

Mux is effectively free at this scale: ~10 minutes of stored video, delivery well within the 100K free minutes/month tier.

## 3. Architecture Approach

**Supabase-heavy.** Lean into Supabase for everything it can do — database with Row-Level Security policies, Supabase Auth for magic links, business logic in Next.js API routes and Server Components. The database enforces multi-tenant isolation via RLS.

### Multi-Tenancy

Shared database with a `client_id` tenant column on all tenant-scoped tables. RLS policies on every table ensure employees can only access their own client's data. No schema-per-tenant or database-per-tenant complexity — this is a handful of clients with hundreds of employees, not thousands of tenants.

## 4. Data Model

### `clients`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid, PK | |
| name | text | "Orange Belgium" |
| slug | text, unique | URL-friendly identifier |
| logo_url | text, nullable | Client branding |
| is_active | boolean | Soft enable/disable |
| created_at | timestamptz | |

### `client_allowed_domains`

Which email domains can self-onboard for each client.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid, PK | |
| client_id | uuid, FK → clients | |
| domain | text | "orange.com", "orange.be" |
| **unique** | | (client_id, domain) |

A client can have multiple allowed domains (e.g., orange.com, orange.fr, orange.be) — all map to the same client.

### `client_languages`

Controls which languages employees see in the language picker.

| Column | Type | Notes |
|--------|------|-------|
| client_id | uuid, FK → clients | |
| language | text | ISO 639-1: 'en', 'fr', 'de' |
| **PK** | | (client_id, language) |

English is the system-wide fallback language. Every lesson must have an English translation. This table only controls the language picker — it does not affect fallback behavior.

### `stores`

Physical locations, uploaded via CSV or created manually per client.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid, PK | |
| client_id | uuid, FK → clients | |
| name | text | "Orange Store Antwerp Central" |
| city | text, nullable | For grouping/filtering in picker |
| country_code | text, nullable | ISO 3166-1 |
| external_id | text, nullable | Client's own store ID from CSV |
| is_active | boolean | |
| created_at | timestamptz | |
| updated_at | timestamptz | Auto-updated via Postgres trigger |

CSV import requires `name` as the only mandatory column. Optional columns: `city`, `country_code`, `external_id`. Small clients (6 stores) can add stores manually.

### `users`

Extended user data linked to Supabase Auth.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid, PK, FK → auth.users | Same ID as Supabase Auth user |
| client_id | uuid, FK → clients, nullable | Resolved from email domain at signup. Null for Pandas internal admins |
| store_id | uuid, FK → stores, nullable | Null = HQ / not assigned to a store |
| email | text, unique | Synced from auth on signup |
| preferred_language | text | ISO 639-1, default 'en' |
| subtitles_enabled | boolean | Default true. Persists across sessions |
| onboarding_completed | boolean | Has finished the first-time Reels flow |
| store_confirmed_at | timestamptz, nullable | For periodic re-confirmation (30-day cycle) |
| role | text | 'employee' or 'admin'. Future: 'client_admin' |
| created_at | timestamptz | |
| updated_at | timestamptz | Auto-updated via Postgres trigger |

**Store re-confirmation:** If `store_confirmed_at` is older than 30 days, the app shows the store selection step on next login (pre-filled with current selection). Handles employee rotation between stores without complex store-history tracking.

**"I'm not assigned to a store":** During store selection, an option for HQ/non-store employees sets `store_id = null`. These users still go through training; they just aren't tied to a store in analytics.

### `lessons`

A single piece of training content. The lesson row is a container — it holds no user-facing content. All displayable content (title, video, notes) lives in `lesson_translations`.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid, PK | |
| internal_name | text | Admin-only label: "Vision AI Retail - Generic" |
| type | text | 'training' for MVP. Future: 'announcement', 'update' |
| sort_order | integer | Controls sequence in the Reels flow |
| is_published | boolean | |
| created_at | timestamptz | |

**Future-proofing:** The `type` field costs nothing now and enables the future vision of a retail employee communication platform (announcements, updates, policy changes) without a migration.

**Client-specific variations:** For bespoke client content (e.g., "Vision AI Retail / T-Mobile"), create a separate lesson row with its own translations and assign it only to that client via `client_lessons`. The generic version is assigned to everyone else.

### `lesson_translations`

Multi-language content for each lesson. One row per language per lesson.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid, PK | |
| lesson_id | uuid, FK → lessons | |
| language | text | 'en', 'fr', 'de', etc. |
| title | text | User-facing display name |
| description | text, nullable | Short subtitle |
| notes_markdown | text, nullable | Expandable reference material |
| mux_playback_id | text | Mux streaming ID |
| mux_asset_id | text | Mux management ID |
| duration_seconds | integer | For display ("3 min") |
| thumbnail_url | text, nullable | Auto-generated by Mux or custom |
| **unique** | | (lesson_id, language) |

The unique constraint on `(lesson_id, language)` prevents duplicate translations — only one English version, one French version, etc. per lesson.

**Language fallback:** When an employee's preferred language doesn't have a translation for a specific lesson, the system falls back to English (guaranteed to exist). In the Browse shell, a subtle badge indicates the available language.

**Dubbed vs. subtitled:** Each translation can have its own `mux_playback_id` (dubbed video from HeyGen/ElevenLabs) or share the same `mux_playback_id` as another translation (same video, different subtitle track). The player handles this transparently — if two translations point to the same Mux asset, it switches subtitle tracks; if different assets, it switches videos.

### `client_lessons`

Assignment table — which lessons are assigned to which client.

| Column | Type | Notes |
|--------|------|-------|
| client_id | uuid, FK → clients | |
| lesson_id | uuid, FK → lessons | |
| **PK** | | (client_id, lesson_id) |

### `lesson_completions`

Tracks which employee completed which lesson, with their rating.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid, PK | |
| user_id | uuid, FK → users | |
| lesson_id | uuid, FK → lessons | |
| rating | integer, NOT NULL | Quick Check rating (1-5 scale). CHECK constraint: rating >= 1 AND rating <= 5 |
| completed_at | timestamptz | |
| **unique** | | (user_id, lesson_id) |

Completion is per lesson, not per translation. An employee who watches "Vision AI Retail" in French has the same completion record as one who watches it in English. Progress is calculated from the relationship: count of completions for a user vs. count of lessons assigned to their client.

**Re-rating:** If an employee re-watches a lesson, they can update their rating. The `POST /api/lessons/[id]/complete` endpoint performs an upsert — if a completion already exists, it updates the rating and `completed_at` timestamp.

### Relationships

```
clients ─┬── client_allowed_domains (1:many)
         ├── client_languages (1:many)
         ├── stores (1:many)
         ├── users (1:many)
         └── client_lessons ──┐
                              │
lessons ──┬── lesson_translations (1:many, one per language)
          └── client_lessons ──┘ (many:many assignment)

users ── lesson_completions ── lessons (many:many through completions)
```

## 5. Auth Flow

### Domain-Allowlisted Magic Link Authentication

Employees self-onboard by entering their work email. The system validates the email domain against `client_allowed_domains` and sends a magic link + OTP code. No passwords, no invites, no admin overhead per employee.

**First-time employee signup:**

1. Employee opens the portal URL, enters their work email (e.g., jan@orange.be)
2. Next.js API route (`/api/auth/login`) checks: does "orange.be" exist in `client_allowed_domains`?
   - No → "This email is not authorized. Contact your manager."
   - Yes → Call Supabase `signInWithOtp()` to send magic link + OTP
3. Employee clicks link or enters code → authenticated
4. Database trigger fires: looks up `client_id` from the matching domain, creates a row in `users` (id = auth user id, client_id, email, role = 'employee')
5. Employee enters the onboarding flow: Language → Welcome → Store selection → Reels shell
6. After store selection, the user is redirected to `/watch/[firstLessonId]` where `firstLessonId` is the first lesson by `sort_order` assigned to their client. The Reels shell auto-advances through all assigned lessons in sequence.
7. `onboarding_completed = true`, `store_confirmed_at = now()`

**Returning employee login:**

1. Enter email → magic link/OTP → authenticated
2. Middleware checks: `onboarding_completed`? `store_confirmed_at` older than 30 days?
3. If all good → straight to Browse shell

**Admin login:**

Same magic link flow. Admin users are pre-registered in the `users` table with `role = 'admin'` and `client_id = null`. Their email does not need to match any `client_allowed_domains` — they're explicitly whitelisted. After auth, middleware routes them to `/admin`.

**Admin management:** The admin panel has a Members section where Pandas team members can add/remove admin users by email.

### Middleware Routing

```
Every request:
  → Is user authenticated?
    → No  → redirect to /login
    → Yes → Is role = admin?
      → Yes → Is path /admin/*? → Allow
             → Otherwise → redirect to /admin
      → No (employee) → Is onboarding complete?
        → No  → redirect to /onboarding
        → Yes → Is store_confirmed_at > 30 days?
          → Yes → redirect to /onboarding/store (re-confirm, pre-filled)
          → No  → Allow
```

### Domain Validation

Domain validation runs server-side in a Next.js API route (`/api/auth/login`) using the **service role key** (bypasses RLS, since this runs before the user is authenticated). The logic is:

1. Extract the domain from the submitted email
2. Check if the domain exists in `client_allowed_domains` → if yes, send OTP
3. If no domain match, check if a `users` row exists with that email and `role = 'admin'` → if yes, send OTP
4. If neither condition is met → reject with "This email is not authorized"

No email is ever sent to unauthorized addresses. The two-step check ensures both employees (domain match) and admins (explicit whitelist) can authenticate through the same login screen.

## 6. Row-Level Security

RLS ensures that even with a bug in application code, one client's employees can never access another client's data.

Every authenticated Supabase request includes a JWT with the user's ID. RLS policies use this to look up the user's `client_id` and scope every query.

### Core Policies

```sql
-- Users: SELECT own record only
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (id = auth.uid());

-- Users: no INSERT policy for authenticated role.
-- Row creation is handled by a SECURITY DEFINER trigger function
-- that fires on auth.users insert. This bypasses RLS.
-- No authenticated user should be able to insert into users directly.

-- Users: no client-side UPDATE. All profile updates go through
-- PATCH /api/user/profile (server-side, service role key).
-- This prevents users from modifying their own role, client_id,
-- or onboarding_completed via the client-side SDK.

-- Clients: users can see their own client (for branding/logo)
CREATE POLICY "clients_own" ON clients
  FOR SELECT USING (
    id = (SELECT client_id FROM users WHERE id = auth.uid())
  );

-- Stores: users can only see stores for their client
CREATE POLICY "stores_same_client" ON stores
  FOR SELECT USING (
    client_id = (SELECT client_id FROM users WHERE id = auth.uid())
  );

-- Lessons: users can only see published lessons assigned to their client
CREATE POLICY "lessons_for_client" ON lessons
  FOR SELECT USING (
    id IN (
      SELECT lesson_id FROM client_lessons
      WHERE client_id = (SELECT client_id FROM users WHERE id = auth.uid())
    )
    AND is_published = true
  );

-- Translations: users see translations for accessible lessons only
CREATE POLICY "translations_for_accessible_lessons" ON lesson_translations
  FOR SELECT USING (
    lesson_id IN (
      SELECT lesson_id FROM client_lessons
      WHERE client_id = (SELECT client_id FROM users WHERE id = auth.uid())
    )
  );

-- Completions: SELECT/UPDATE/DELETE own records
CREATE POLICY "completions_select_own" ON lesson_completions
  FOR SELECT USING (user_id = auth.uid());

-- Completions: INSERT only for own user_id AND only for assigned lessons
CREATE POLICY "completions_insert_own" ON lesson_completions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND lesson_id IN (
      SELECT lesson_id FROM client_lessons
      WHERE client_id = (SELECT client_id FROM users WHERE id = auth.uid())
    )
  );

-- Client languages: users see their client's languages
CREATE POLICY "languages_same_client" ON client_languages
  FOR SELECT USING (
    client_id = (SELECT client_id FROM users WHERE id = auth.uid())
  );

-- client_allowed_domains: no policy for authenticated role.
-- Only queried server-side via service role key during login.
```

### User Creation Trigger

The `users` row is created by a **SECURITY DEFINER** function triggered on `auth.users` insert. This function:
1. Looks up the `client_id` by matching the new user's email domain against `client_allowed_domains`
2. Inserts a row into `users` with the auth user's ID, resolved `client_id`, email, and `role = 'employee'`
3. Runs with elevated privileges (bypasses RLS), so no INSERT policy is needed on `users` for the `authenticated` role

For admin users (pre-registered with `role = 'admin'` and `client_id = null`), the row is created manually via the admin panel using the service role key.

### Admin Access

Admin operations go through Next.js API routes using a Supabase **service role key** (bypasses RLS). The service role key is server-side only — never exposed to the browser. No complex admin RLS policies needed for MVP.

All employee profile updates (`PATCH /api/user/profile`) also go through the server-side API route with the service role key. This ensures users cannot modify sensitive fields (`role`, `client_id`) via the client-side SDK. The API route validates and restricts updates to: `preferred_language`, `subtitles_enabled`, `store_id`, `store_confirmed_at`, `onboarding_completed`.

## 7. API & Route Design

### Next.js Routes

**Public:**
```
/login                → Email input + OTP entry
```

**Employee (auth required):**
```
/onboarding           → Typeform-style flow (language, welcome, store)
/browse               → Browse shell (Netflix grid) — home for returning users
/watch/[lessonId]     → Reels shell — full-screen video player
```

**Admin (auth + role = admin):**
```
/admin                → Dashboard overview
/admin/clients        → Client management (CRUD, domains, languages)
/admin/lessons        → Lesson management (CRUD, translations, Mux upload)
/admin/stores         → Store management (CSV upload, list)
/admin/analytics      → Completion metrics per client
/admin/members        → Admin user management
```

### API Routes

```
POST /api/auth/login              → Domain check + trigger OTP
POST /api/auth/callback           → Handle magic link redirect

GET  /api/lessons                 → Lessons for current user (respects language + client)
GET  /api/lessons/[id]            → Single lesson with translation in preferred language
POST /api/lessons/[id]/complete   → Mark complete + submit rating

PATCH /api/user/profile           → Update language, store, subtitles preference

POST /api/webhooks/mux            → Receive Mux processing callbacks

-- Admin only (standard REST: GET list, GET by id, POST create, PATCH update, DELETE) --
/api/admin/clients/*              → Client CRUD + manage domains and languages
/api/admin/lessons/*              → Lesson CRUD + manage translations + Mux upload
/api/admin/stores/*               → Store CRUD + CSV import
/api/admin/members/*              → Admin user management
GET  /api/admin/analytics         → Completion stats per client
GET  /api/admin/analytics/[clientId] → Client detail: funnel, store table, lesson breakdown
```

All admin routes use the Supabase service role key server-side. Standard REST conventions apply — only non-obvious routes are listed explicitly above.

### Data Fetching Pattern

Employee-facing pages use the **Supabase client-side SDK with RLS** for simple reads. The user's JWT scopes all queries automatically. API routes are used for operations that need server-side logic: domain validation, Mux uploads, CSV parsing, analytics aggregation.

## 8. Mux Integration

### Video Upload Workflow

1. Admin creates a lesson in the admin panel (internal name, type, sort order)
2. Admin clicks "Add Translation" → selects language, enters title, description, notes
3. Admin clicks "Upload Video" → file picker opens
4. API route calls Mux: request a direct upload URL
5. Browser uploads the file directly to Mux (video never passes through our server)
6. Mux processes the video: encodes into multiple quality levels, generates thumbnail, creates HLS streaming segments (30 seconds to a few minutes)
7. Mux sends a webhook to `/api/webhooks/mux` with `video.asset.ready` event
8. Webhook handler updates `lesson_translations`: `mux_asset_id`, `mux_playback_id`, `duration_seconds`, `thumbnail_url`
9. Admin panel shows "Video ready"

### Auto-Generated Subtitles

When uploading to Mux, auto-captioning is enabled with the `generated_subtitles` parameter set to the video's audio language. Mux uses OpenAI Whisper to generate captions.

**Supported languages (stable):** English, Spanish, Italian, Portuguese, German, French, Automatic Detection

**Supported languages (beta):** Polish, Russian, Dutch, Catalan, Turkish, Swedish, Ukrainian, Norwegian, Finnish, Slovak, Greek, Czech, Croatian, Danish, Romanian, Bulgarian

Subtitles are generated in the same language as the audio. Cross-language subtitles (e.g., French subtitles on an English video) are a v2 feature requiring a translation pipeline.

### Subtitle UX

- Subtitles default to ON for all users
- Toggle persists on the user record (`subtitles_enabled` boolean)
- When toggled off, stays off across all videos and sessions until turned back on
- Standard CC button in the video player UI
- Subtitle styling is fully customizable via CSS (`::cue` selectors) — font, color, background, border radius, positioning

### AI Dubbing Workflow (External)

For dubbed video translations, the workflow happens outside the platform:

1. Original English video → ElevenLabs (voice cloning) + HeyGen (lip-sync, translated script)
2. HeyGen outputs a dubbed video file (e.g., vision-ai-retail-fr.mp4)
3. Admin uploads the dubbed file as a new translation in the admin panel
4. Same Mux upload flow → gets its own `mux_playback_id`
5. Mux auto-generates subtitles in the dubbed language

### Playback

The `<MuxPlayer>` React component handles adaptive streaming, preloading, and mobile-optimized playback. It only needs the `mux_playback_id` to stream — all encoding, CDN delivery, and quality adaptation is handled by Mux.

## 9. Analytics

### Overview Dashboard (All Clients)

One card per client with three key metrics:

**Metric 1 — Store Activation:**
"X / Y stores have training activity"

A store counts as "active" if at least one employee has completed at least one lesson. This is the rollout breadth indicator.

**Metric 2 — Average Trained Employees per Active Store:**
"On average, X employees per active store have completed all training"

An employee counts as "trained" if they've completed all assigned lessons. Calculated across active stores only (stores with zero activity are excluded to avoid dragging the average down).

**Metric 3 — Average Rating + Response Count:**
"4.2 / 5 (from 47 responses)"

Average rating across all completions for this client, with the number of responses displayed alongside. Small sample sizes are immediately visible.

### Client Detail View

**Training Funnel (horizontal bar chart with conversion rates):**

```
Logged In:              ████████████████████████████████  312
                                    79.2% ↓
Completed 1+ lessons:   █████████████████████████         247
                                    80.2% ↓
Completed all lessons:  ████████████████████              198
```

Shows drop-off at each stage. Big drop between "logged in" and "completed 1+"? Engagement problem. Big drop between "completed 1+" and "completed all"? A specific lesson might be the bottleneck.

**Store Table (sortable, filterable):**

| Store | City | Employees Logged In | Completed All | Completion % | Avg Rating |
|-------|------|--------------------|--------------|-----------  -|------------|
| Antwerp Central | Antwerp | 8 | 6 | 75% | 4.3 (6) |
| Brussels Midi | Brussels | 2 | 0 | 0% | — |
| Ghent Station | Ghent | 0 | 0 | — | — |

Key filters:
- "No activity" — stores with zero logins (flag to client)
- "Low completion" — employees logged in but few completed (needs nudge)
- "On track" — healthy completion rates

**Lesson Breakdown:**
Each lesson with completion count, completion rate, average rating + response count. Identifies problematic lessons (low rating) or bottleneck lessons (low completion relative to others).

**Employee List:**
Searchable by email or store. Shows: email, store, lessons completed (3/6), last active, status (Not started / In progress / Completed).

**Timeline Chart:**
Training activity over time (logins or completions per day/week). Shows the adoption curve since rollout.

### Data Source

All analytics are derived from existing tables — no separate analytics tables or pre-aggregation needed at this scale. Queries run against `users`, `lesson_completions`, `client_lessons`, and `stores` with standard aggregations (COUNT, AVG, GROUP BY).

## 10. MVP Scope

### v1 (MVP)

- Auth: domain-allowlisted magic link + OTP
- Onboarding: Typeform-style flow (language, welcome, store selection)
- Store re-confirmation every 30 days
- Lessons: video playback via Mux with auto-generated subtitles
- Multi-language: translations per lesson, language picker scoped to client
- Completion tracking with Quick Check rating
- Browse shell (Netflix grid) for returning users
- Reels shell (TikTok/Stories) for video playback
- Admin panel: client CRUD, lesson + translation management, Mux upload, store management (CSV + manual), analytics dashboard, admin member management
- Language fallback: preferred language → English

### v2 (Future)

- Client admin role (client managers viewing their own analytics)
- Cross-language subtitles (AI-translated subtitle pipeline)
- Auto-translation of subtitles (DeepL/GPT integration)
- Geolocation-based store selection
- Admin-only lesson visibility tag
- AI dubbing pipeline integration (ElevenLabs + HeyGen automated workflow)
- "I still have questions" support integration
- Content type expansion: announcements, updates, policy changes
- Translation coverage matrix in admin panel
- Store history tracking on completions
- Configurable store status thresholds per client

### Explicitly Not in v1

- Client-scoped admin roles
- Per-video language switching
- Free-text feedback on ratings
- Video filming format decisions (vertical vs. landscape — resolved when filming starts)
- Desktop layout specifics (resolved during frontend phase)
- Real-time features or push notifications

## 11. Future Vision

The Training Portal is the first use case for a broader **retail employee communication platform**. The same pattern — short video + notes, pushed to distributed employees — works for product launches, policy changes, seasonal promotions, and operational announcements. The data model supports this via the `type` field on lessons without requiring architectural changes.

The `role` field on users supports future expansion to `client_admin` without schema changes. A client admin would have `role = 'client_admin'` with a `client_id`, giving them RLS-scoped access to their own client's data plus additional UI surfaces for analytics.
