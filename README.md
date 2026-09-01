# Belong

Church membership management, as a multi-tenant SaaS. Web app for recording member bio data, membership status, households, ministries, and attendance. Built for 100–5000 members per church.

## Stack
- **API**: Hono (Node.js) + PostgreSQL
- **Web**: React + Vite
- **Deployment**: Docker Compose (Postgres + API + Nginx-served frontend)

## Local development (without Docker)

**1. Database**
Install Postgres locally, then:
```
createdb church_membership
psql church_membership -f db/schema.sql
```

**2. API**
```
cd api
npm install
cp .env.example .env   # edit DATABASE_URL if needed
npm run dev
```
API runs on http://localhost:3001

Create your first admin user:
```
npx tsx src/seed.ts admin@yourchurch.org yourpassword "Your Name"
```

**3. Frontend**
```
cd web
npm install
npm run dev
```
Frontend runs on http://localhost:5173 — log in with the admin account you seeded.

## Deploying on a VPS (Docker Compose)

From the project root:
```
cp .env.example .env            # set DB_PASSWORD, JWT_SECRET; VITE_API_URL defaults to /api
cp docker-compose.override.yml.example docker-compose.override.yml   # publishes web on :8080
docker compose up -d --build
```

This starts Postgres (5432), the API (3001), and the web app. The web container's
Nginx serves the frontend **and reverse-proxies `/api` to the API**, so the whole
app is one origin — no CORS, and it works the same over a bare IP or a domain.
`db`/`api` publish ports for convenience; `web` gets its host port from the
override file (or from Traefik labels — below).

Seed your first admin user:
```
docker compose exec api npx tsx src/seed.ts admin@yourchurch.org yourpassword "Your Name"
```
Grant the cross-tenant platform operator flag (for the `/admin` console):
```
docker compose exec api npx tsx src/promote-superadmin.ts admin@yourchurch.org
```

### Deploying behind Traefik (domain + TLS)

Instead of the override above, give `web` Traefik labels (Docker provider; adjust
entrypoint / certresolver / network names to your Traefik) in
`docker-compose.override.yml`:
```yaml
services:
  web:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.belong.rule=Host(`your-domain.example`)"
      - "traefik.http.routers.belong.entrypoints=websecure"
      - "traefik.http.routers.belong.tls=true"
      - "traefik.http.routers.belong.tls.certresolver=letsencrypt"
      - "traefik.http.services.belong.loadbalancer.server.port=80"
```
Then set `APP_URL=https://your-domain.example` in `.env` (used for password-reset
email links; `VITE_API_URL` stays `/api`). One route only — the Nginx `/api`
proxy handles the API.

## What's built (v1)

- Member records: personal info, membership status (Visitor / New convert / Member / Inactive), date joined, baptism date, occupation, emergency contact
- Household/family grouping
- Ministry/department assignment (multi-select per member)
- Search and filter members by name/status/ministry, with pagination
- Attendance: create a service by date, check members in/out, view per-service attendance
- CSV import: bulk-load members from a spreadsheet — download the template from the Import page, fill it in as you digitize paper records, upload. Household and ministry names are matched or created automatically. Failed rows are reported individually so one bad row doesn't block the rest.
- Role-based login (admin/staff/leader roles exist in the schema; UI currently treats all logged-in users the same — restricting by role in the UI is a natural next step)

## Not yet built (roadmap)
- Photo upload for member records
- Birthday/anniversary reports
- Export to Excel/PDF
- Ministry leader dashboards (view-only access scoped to their ministry)
- Giving/tithes tracking (kept separate deliberately — flag when you're ready to add it, since it needs tighter access control)

## Data entry tip
Since you're digitizing from paper, the member form auto-creates a household on save if you type a new household name instead of picking an existing one — no need to pre-create households first.
