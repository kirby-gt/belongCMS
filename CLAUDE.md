# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Belong — church membership management as multi-tenant SaaS. Records member bio data, membership status, households, ministries, and attendance, for churches of 100–5000 members.

**Stack**: Hono (Node.js) API + PostgreSQL, React + Vite frontend, deployed via Docker Compose (Postgres + API + Nginx-served frontend). No test suite exists in this repo.

## Commands

**Database** (no migration tool — `db/schema.sql` is the single source of truth, run directly):
```
createdb church_membership
psql church_membership -f db/schema.sql
```

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
Activate a trialing/pending org's subscription manually:
```
npx tsx src/verify-subscription.ts <admin-email-or-organization-id>
```

**Web** (`web/`):
```
npm install
npm run dev      # vite, http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint     # oxlint
npm run preview
```

**Docker Compose** (from repo root, full stack): `docker compose up -d --build`. Postgres on 5432 (schema auto-loaded via volume-mounted `db/schema.sql` on first run only — not re-applied on existing volumes), API on 3001, web/Nginx on 8080. Seed inside the container: `docker compose exec api npx tsx src/seed.ts <email> <password> [name] [org]`.

## Architecture

### Multi-tenancy is the central constraint

Every table (except `organizations` itself) has an `organization_id` FK. There is no Postgres RLS — tenant isolation is enforced entirely in application code by hand-adding `and organization_id = $N` to every query. **Any new query touching a tenant-scoped table must filter by the org id pulled from the authenticated user's JWT**, never from a client-supplied value. `organization_id` comes from `(c.get("user") as AuthUser).organization_id` in every route handler — see `api/src/routes/members.ts` for the pattern used throughout (list/get/create/update/delete all repeat this filter independently; there's no shared query-builder or ORM abstracting it).

When a route accepts a foreign id from the client that references another tenant-scoped table (e.g. `household_id`, `ministry_ids` on a member), it must be re-verified against the current org before use — see `verifyHouseholdForOrg` / `filterMinistryIdsForOrg` in `api/src/routes/members.ts`. Don't trust an id just because it parsed as a UUID.

### Auth and subscription gating (both API and web mirror this)

- JWT (`api/src/auth.ts`) encodes `{ id, email, role, organization_id }`, signed with `JWT_SECRET`, 7-day expiry. `requireAuth` middleware decodes it onto Hono's context as `user`.
- `requireActiveOrg` returns 402 unless the org has access per `orgHasAccess()` (also in `api/src/auth.ts`, mirrored in `web/src/subscription.ts` — keep the two in sync). Access = **unexpired trial** (`trialing`/`pending_review` with `trial_ends_at` in the future, 14-day trial from signup) **OR paid-and-current** (`active`/`pending_review` with `current_period_end` within `RENEWAL_GRACE_DAYS` (5) of now). Subscriptions are a **manual monthly cycle**: the church pays via MMG mobile money and submits a reference (`POST /organizations/subscribe` → `pending_review`); a super-admin verifies it (`POST /admin/organizations/:id/activate` with `{ months }`, default 1), which sets `plan_status='active'` and `current_period_end = greatest(current_period_end, now()) + months·1mo` — so a lapsed org's cycle starts at payment receipt while an in-period org stacks the months (pay early / pay several months ahead, no lost days). There is no automated/recurring billing and no payment processor (see roadmap note). `ProtectedRoute` shows a renewal banner from 5 days before `current_period_end` (normal) through the 5-day grace after (urgent). In `api/src/index.ts`, routes are wired in tiers: `/organizations/*` needs only `requireAuth` (so a locked-out org can still view/manage billing), while `/members`, `/households`, `/ministries`, `/attendance`, `/dashboard`, `/visitor-checkins` need `requireAuth` + `requireActiveOrg`. Preserve this tiering when adding routes — new tenant-data routes go in the second tier. `/public/*` (visitor QR check-in) is unauthenticated and sits above all of this.
- `role` (`admin`/`staff`/`leader`) exists in the schema and JWT, and `requireRole()` exists in `auth.ts`, but no route currently uses it and the web UI doesn't branch on role — it's schema/plumbing ahead of feature. Don't assume role-based UI restrictions exist yet.
- **Super-admin / `/admin/*` tier**: `users.is_superadmin` (a cross-tenant platform-operator flag, unrelated to `role`) gates `api/src/routes/admin.ts`, mounted with `requireAuth` + `requireSuperAdmin` (which re-checks the flag against the DB, not the JWT). These routes **intentionally do not filter by `organization_id`** — a super-admin lists and manages every org's subscription (verify-payment/activate with `{ months }`, extend-trial, cancel). This is the one deliberate exception to the multi-tenancy rule above; keep it confined to this tier. Grant the flag with `npx tsx src/promote-superadmin.ts <email> [--revoke]`. Web: `SuperAdminRoute` + `/admin` page, nav link shown only when `user.is_superadmin`.
- The web side mirrors the same gate with nested routes in `web/src/App.tsx`: `ProtectedRoute` (must be logged in) wraps everything except `/login`/`/signup`/`/welcome/:token`; `SubscriptionGate` (must have active trial/subscription) wraps the actual data pages but not `/billing` or `/admin`; `SuperAdminRoute` wraps `/admin`. `AuthContext` holds the JWT/user in `localStorage` and fetches `organization` on load to drive `SubscriptionGate`.

### API route/db conventions

- Every route module (`api/src/routes/*.ts`) exports a `Hono()` instance mounted in `api/src/index.ts`; no controller/service layering — request parsing, validation (Zod), and raw SQL live together in the route handler.
- No query builder or ORM: `query<T>(sql, params)` and `withTransaction(fn)` from `api/src/db.ts` wrap `pg` directly. SQL is hand-written with `$N` placeholders; dynamic filter lists are built by pushing into a `conditions`/`params` array pair before joining (see `members.ts` GET `/`).
- CSV import (`members.ts` `POST /import`) resolves `household_name`/`ministries` strings to ids by find-or-create, and processes rows in a loop reporting per-row success/failure rather than transactional all-or-nothing — a bad row doesn't block the rest. Follow this pattern for any similar bulk-load feature rather than wrapping the whole batch in one transaction.
- Signup (`api/src/routes/auth.ts`) creates an org + admin user together inside `withTransaction`, resolving slug collisions with a loop inside the transaction to avoid races between concurrent signups with the same church name.

### Frontend conventions

- `web/src/api.ts` is a single flat object of typed request functions wrapping `fetch`; there's no per-resource API module split. Add new endpoints here.
- Auth token lives in `localStorage` (`token`, `user` keys), attached as `Authorization: Bearer` in `api.ts`'s `request()`. Not httpOnly-cookie based.
- Routing/pages are flat under `web/src/pages/`, no nested route-based code splitting.
- Linting uses `oxlint`, not ESLint (`web/.oxlintrc.json`).

## Roadmap context (don't build unprompted)

Giving/tithes tracking is planned but not yet implemented — it needs tighter access control than the current role plumbing provides, and is intended to be a paid-tier-only feature (see below). Photo upload, birthday/anniversary reports, Excel/PDF export, and ministry-leader-scoped dashboards are also not yet built.

### Paid-tier feature gating (planned, not yet implemented)

The subscription model is currently binary — `organizations.plan_status` (`trialing`/`active`/`pending_review`/`canceled`) gates access to the app as a whole via `requireActiveOrg`, with no distinction between paid tiers. The intent going forward is to introduce multiple paid tiers where some features (starting with giving/tithes) are only available on a higher tier, not just to any `active` org. When this is picked up, it needs a design pass before implementation — at minimum: how a tier is represented (e.g. a `plan_tier` column vs. separate plan/feature tables), how it's enforced server-side (a `requireFeature()`-style middleware alongside `requireActiveOrg`, since gating must live in the API, not just be hidden in the UI), and how it interacts with the existing trial period. Don't build this piecemeal inside an unrelated feature's PR — treat it as its own design/implementation task.
