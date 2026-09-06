# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Belong — church membership management as multi-tenant SaaS. Records member bio data, membership status, households, ministries, and attendance, for churches of 100–5000 members.

**Stack**: Hono (Node.js) API + PostgreSQL, React + Vite frontend, deployed via Docker Compose. The web container's Nginx serves the built SPA **and reverse-proxies `/api` to the API container**, so the whole app is one origin. No test suite exists in this repo.

## Deployment workflow (required)

Two rules govern how changes reach production:

1. **PR gate — no direct pushes to `main`.** Every change to `main` goes through a reviewed pull request. Work on a branch, push it, open a PR, and let the maintainer review and merge on GitHub. This applies to one-line and config-only fixes too.
2. **GitHub `main` is the deploy source of truth.** The VPS only ever runs code pulled from `main`. Deploy = merge the PR, then `git pull` on the VPS. Never move code onto the box another way — no `scp`/`rsync` of source or compose files, no editing files on the server, no `docker compose up --build` from uncommitted local state. The only thing edited in place on the VPS is its `.env` (gitignored, per-host).

**VPS deploy steps**: `cd` to the repo, drop any local drift (`git checkout -- .`), `git pull` `main`; if `db/schema.sql` changed, re-apply it to the running DB (`docker compose exec -T db psql -U postgres -d church_membership < db/schema.sql` — idempotent, run the whole file) **before** rebuilding, so new code never hits a missing table/column; set any new `.env` values; then `docker compose up -d --build`.

## Commands

**Database** (no migration tool — `db/schema.sql` is the single source of truth):
```
createdb church_membership
psql church_membership -f db/schema.sql
```
There is no migration history. Schema changes are written as **idempotent DDL** in `db/schema.sql` (`create table if not exists`, `alter table ... add column if not exists`, `update ... where <col> is null` backfills) and applied to an existing database by re-running the whole file. For a running Compose stack (the volume-mounted schema only auto-loads on first init): `docker compose exec -T db psql -U postgres -d church_membership < db/schema.sql`.

**API** (`api/`):
```
npm install
npm run dev     # tsx watch src/index.ts, http://localhost:3001
npm run start   # tsx src/index.ts, no watch
```
Seed an admin user (also usable to promote/attach an admin to an existing org by email):
```
npx tsx src/seed.ts <email> <password> [name] [organization-name]
```
Activate a subscription from the CLI (equivalent to `POST /admin/organizations/:id/activate` — sets `plan_status='active'` and advances `current_period_end` by one month):
```
npx tsx src/verify-subscription.ts <admin-email-or-organization-id>
```
Grant/revoke the cross-tenant platform-operator flag:
```
npx tsx src/promote-superadmin.ts <email> [--revoke]
```

**Web** (`web/`):
```
npm install
npm run dev      # vite, http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint     # oxlint
npm run preview
```

**Docker Compose** (from repo root). The base `docker-compose.yml` is deployment-portable: `db` publishes 5432, `api` publishes 3001, `web` has **no host port** (its Nginx proxies `/api` internally, so `VITE_API_URL` defaults to `/api` and the app is single-origin). Each environment adds a port or a proxy via an overlay:
- **Local**: `cp docker-compose.override.yml.example docker-compose.override.yml` (publishes `web` on 8080), then `docker compose up -d --build`.
- **Behind Traefik (domain + TLS)**: the deploy VPS runs a shared Traefik with `network_mode: host` and the Docker-label provider (letsencrypt HTTP-01). Set `COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml`, `APP_DOMAIN`, and `APP_URL` in `.env`, then `docker compose up -d --build`. `docker-compose.prod.yml` only adds routing labels to `web` (`Host(APP_DOMAIN) || Host(www.APP_DOMAIN)`, port 80) — host-mode Traefik reaches it over the bridge, so there is **no network config** (`TRAEFIK_CERTRESOLVER`/`TRAEFIK_ENTRYPOINT` default to `letsencrypt`/`websecure`). Don't keep a `docker-compose.override.yml` on that box — if `COMPOSE_FILE` isn't picked up it wins and `web` comes up unlabelled (bare 404).

Seed inside the container: `docker compose exec api npx tsx src/seed.ts <email> <password> [name] [org]`.

**Environment** (`.env` at repo root is the reference — see `.env.example`; `.env` is gitignored):
- API: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `RESEND_API_KEY` (blank → emails logged to stdout, not sent), `MAIL_FROM` (a Resend-verified domain in prod), `APP_URL` (public origin, used to build links in emails).
- Web build arg: `VITE_API_URL` (default `/api`).
- Compose/Traefik: `DB_PASSWORD`, `APP_DOMAIN`, `COMPOSE_FILE`, `TRAEFIK_CERTRESOLVER`, `TRAEFIK_ENTRYPOINT`.

## Architecture

### Multi-tenancy is the central constraint

Every table (except `organizations` itself) has an `organization_id` FK. There is no Postgres RLS — tenant isolation is enforced entirely in application code by hand-adding `and organization_id = $N` to every query. **Any new query touching a tenant-scoped table must filter by the org id pulled from the authenticated user's JWT**, never from a client-supplied value. `organization_id` comes from `(c.get("user") as AuthUser).organization_id` in every route handler — see `api/src/routes/members.ts` for the pattern used throughout (list/get/create/update/delete all repeat this filter independently; there's no shared query-builder or ORM abstracting it).

When a route accepts a foreign id from the client that references another tenant-scoped table (e.g. `household_id`, `ministry_ids` on a member), it must be re-verified against the current org before use — see `verifyHouseholdForOrg` / `filterMinistryIdsForOrg` in `api/src/routes/members.ts`. Don't trust an id just because it parsed as a UUID.

### Auth and subscription gating (both API and web mirror this)

- JWT (`api/src/auth.ts`) encodes `{ id, email, role, organization_id, is_superadmin }`, signed with `JWT_SECRET`, 7-day expiry. `requireAuth` middleware decodes it onto Hono's context as `user`. Privileged checks (`requireSuperAdmin`) re-read the flag from the DB rather than trusting the token.
- `requireActiveOrg` returns 402 unless the org has access per `orgHasAccess()` (also in `api/src/auth.ts`, mirrored in `web/src/subscription.ts` — keep the two in sync). Access = **unexpired trial** (`trialing`/`pending_review` with `trial_ends_at` in the future, 14-day trial from signup) **OR paid-and-current** (`active`/`pending_review` with `current_period_end` within `RENEWAL_GRACE_DAYS` (5) of now). Subscriptions are a **manual monthly cycle**: the church pays via MMG mobile money and submits a reference (`POST /organizations/subscribe` → `pending_review`); a super-admin verifies it (`POST /admin/organizations/:id/activate` with `{ months }`, default 1), which sets `plan_status='active'` and `current_period_end = greatest(current_period_end, now()) + months·1mo` — so a lapsed org's cycle starts at payment receipt while an in-period org stacks the months (pay early / pay several months ahead, no lost days). There is no automated/recurring billing and no payment processor (see roadmap note). `ProtectedRoute` shows a renewal banner from 5 days before `current_period_end` (normal) through the 5-day grace after (urgent). In `api/src/index.ts`, routes are wired in tiers: `/organizations/*` needs only `requireAuth` (so a locked-out org can still view/manage billing), while `/members`, `/households`, `/ministries`, `/attendance`, `/dashboard`, `/visitor-checkins` need `requireAuth` + `requireActiveOrg`. Preserve this tiering when adding routes — new tenant-data routes go in the second tier. `/public/*` (visitor QR check-in) is unauthenticated and sits above all of this.
- `role` (`admin`/`staff`/`leader`) exists in the schema and JWT, and `requireRole()` exists in `auth.ts`, but no route currently uses it and the web UI doesn't branch on role — it's schema/plumbing ahead of feature. Don't assume role-based UI restrictions exist yet.
- **Super-admin / `/admin/*` tier**: `users.is_superadmin` (a cross-tenant platform-operator flag, unrelated to `role`) gates `api/src/routes/admin.ts`, mounted with `requireAuth` + `requireSuperAdmin` (which re-checks the flag against the DB, not the JWT). These routes **intentionally do not filter by `organization_id`** — a super-admin lists and manages every org's subscription (verify-payment/activate with `{ months }`, extend-trial, cancel). This is the one deliberate exception to the multi-tenancy rule above; keep it confined to this tier. Grant the flag with `npx tsx src/promote-superadmin.ts <email> [--revoke]`. Web: `SuperAdminRoute` + `/admin` page, nav link shown only when `user.is_superadmin`.
- The web side mirrors the same gate with nested routes in `web/src/App.tsx`: `ProtectedRoute` (must be logged in) wraps everything except the public routes (`/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/welcome/:token`); `SubscriptionGate` (must have active trial/subscription) wraps the actual data pages but not `/billing` or `/admin`; `SuperAdminRoute` wraps `/admin`. `AuthContext` holds the JWT/user in `localStorage` and fetches `organization` on load to drive `SubscriptionGate`.

### API route/db conventions

- Every route module (`api/src/routes/*.ts`) exports a `Hono()` instance mounted in `api/src/index.ts`; no controller/service layering — request parsing, validation (Zod), and raw SQL live together in the route handler.
- No query builder or ORM: `query<T>(sql, params)` and `withTransaction(fn)` from `api/src/db.ts` wrap `pg` directly. SQL is hand-written with `$N` placeholders; dynamic filter lists are built by pushing into a `conditions`/`params` array pair before joining (see `members.ts` GET `/`).
- CSV import (`members.ts` `POST /import`) resolves `household_name`/`ministries` strings to ids by find-or-create, and processes rows in a loop reporting per-row success/failure rather than transactional all-or-nothing — a bad row doesn't block the rest. Follow this pattern for any similar bulk-load feature rather than wrapping the whole batch in one transaction.
- Signup (`api/src/routes/auth.ts`) creates an org + admin user together inside `withTransaction`, resolving slug collisions with a loop inside the transaction to avoid races between concurrent signups with the same church name.

### Attendance & per-service visitor counts

- A `service` is `(organization_id, service_date, service_type)` — `service_type` is `Sunday` / `Midweek` / `Special` — plus an optional `name` (event label, e.g. "Mother's Day") and an optional `visitor_count` (a manually-entered headcount). `POST /attendance/services` is find-or-create on `(org, date, type)` and will update `name` if you pass one; `PATCH /attendance/services/:id` edits `name` / `service_type` / `visitor_count`; `DELETE` removes it (attendance rows cascade). Per-member presence is one `attendance` row per `(service_id, member_id)` toggled via `POST /attendance/services/:id/checkin`.
- **Average attendance for a month** (`GET /attendance/monthly-summary?month=YYYY-MM`, default current month; also folded into `GET /dashboard/summary` as `attendance_this_month`) is `round(sum(present) / count(services))` **over only the services that had any attendance recorded**, so a service created but never checked-in doesn't drag the average to 0. A Sunday-only average is reported alongside the all-services one.
- **Visitors for a particular service/event** is deliberately three numbers, surfaced together (`GET /attendance/services/:id/summary` and each row of the monthly summary): `visitor_count` (manual headcount), `visitor_checkins` (public QR self-check-ins whose `checked_in_at::date` equals the service date — matched by date, *not* an FK, so two services on one day can't be told apart), and `visitors_present` (members marked present whose `membership_status` is still `Visitor`). Rollups (monthly total, dashboard card) use `visitor_count` when set, otherwise `visitor_checkins`.
- Web: `/attendance` page (`web/src/pages/Attendance.tsx`) — month summary + per-service table as the list view, and a per-service detail view for taking the roster and entering the manual visitor headcount.

### Reports

- `api/src/routes/reports.ts` (mounted `requireAuth` + `requireActiveOrg`, same tier as `/members` etc.) exposes five read-only report endpoints, each returning JSON with a `generated_at` and echoing its params: `GET /reports/attendance-summary?start&end` (per-service rows reusing the exported `SERVICE_FIGURES` / `MonthlyServiceRow` from `attendance.ts`, plus a `summary` and a `compare_summary` for the immediately-preceding equal-length range), `GET /reports/absentees?weeks&status&ministry_id` (members present at least once but not within `weeks*7` days), `GET /reports/member-directory?status&ministry_id&household_id&sort`, `GET /reports/milestones?month=YYYY-MM` (birthdays / baptism / membership anniversaries in that month; anniversary-year math builds the date from a day-offset added to Jan 1 to dodge `make_date` on Feb 29), and `GET /reports/ministry-roster?ministry_id`.
- **No server-side file generation.** CSV is built on the client with `papaparse` (`downloadCsv` in `web/src/reportCsv.ts`); "PDF" is the browser's Print dialog via an `@media print` stylesheet in `index.css` (`.no-print` hides chrome, `.report-print-header` is print-only). Shared web pieces: `web/src/components/ReportView.tsx` (page chrome + CSV/Print buttons + print header) and `DateRangePicker.tsx`. One page per report under `/reports` (`web/src/pages/Report*.tsx`), listed on the `/reports` index.
- `member_status_history` (org_id, member_id, old_status, new_status, changed_at) logs every membership-status transition. Written from `api/src/routes/members.ts` — create and status-changing `PUT` wrap the member write + history row in `withTransaction`; `POST /import` adds an enrolment row per created member in its per-row loop. `db/schema.sql` backfills one synthetic `old_status = null` row per existing member. **Nothing reads this table yet** — it's groundwork for growth / conversion-pipeline reports.

### Transactional email

`api/src/mailer.ts` wraps Resend. `sendEmail({ to, subject, html, text })` sends via the API key; **if `RESEND_API_KEY` is unset it `console.log`s the message instead** so dev/test flows work without credentials. Templates (`passwordResetEmail`, `welcomeEmail`, …) are plain functions returning `{ subject, text, html }`; interpolated user-supplied strings are HTML-escaped. Callers send **best-effort** — wrapped in `try/catch`, failure logged, never blocking the request (see `/auth/signup` welcome mail and `/auth/forgot-password` reset link). Links in emails are built from `APP_URL`.

### Frontend conventions

- `web/src/api.ts` is a single flat object of typed request functions wrapping `fetch`; there's no per-resource API module split. Add new endpoints here.
- Auth token lives in `localStorage` (`token`, `user` keys), attached as `Authorization: Bearer` in `api.ts`'s `request()`. Not httpOnly-cookie based.
- Routing/pages are flat under `web/src/pages/`, no nested route-based code splitting.
- Linting uses `oxlint`, not ESLint (`web/.oxlintrc.json`).

## Roadmap context (don't build unprompted)

Giving/tithes tracking is planned but not yet implemented — it needs tighter access control than the current role plumbing provides, and is intended to be a paid-tier-only feature (see below). Native Excel (`.xlsx`) / server-rendered PDF export, ministry-leader-scoped dashboards (reports currently ship visible to any logged-in user of an active org), and growth / conversion-pipeline reports off `member_status_history` are not yet built. (Member photo upload — `POST /members/:id/photo`, files under `uploads/<org>/`, served via `/uploads/*` — **is** built. Attendance capture + monthly-average / per-service-visitor reporting — see the Attendance section above — **is** built. An **upcoming-birthdays** widget — members with a birthday in the next 7 days, folded into `GET /dashboard/summary` as `upcoming_birthdays` — **is** built. A **Reports** area — attendance summary, absentee/at-risk list, member directory, birthdays/anniversaries, ministry roster, each CSV-exportable and printable-to-PDF — see the Reports section above — **is** built.)

### Paid-tier feature gating (planned, not yet implemented)

The subscription model is currently binary — `organizations.plan_status` (`trialing`/`active`/`pending_review`/`canceled`) gates access to the app as a whole via `requireActiveOrg`, with no distinction between paid tiers. The intent going forward is to introduce multiple paid tiers where some features (starting with giving/tithes) are only available on a higher tier, not just to any `active` org. When this is picked up, it needs a design pass before implementation — at minimum: how a tier is represented (e.g. a `plan_tier` column vs. separate plan/feature tables), how it's enforced server-side (a `requireFeature()`-style middleware alongside `requireActiveOrg`, since gating must live in the API, not just be hidden in the UI), and how it interacts with the existing trial period. Don't build this piecemeal inside an unrelated feature's PR — treat it as its own design/implementation task.
