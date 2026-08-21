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
cp .env.example .env   # set DB_PASSWORD, JWT_SECRET, VITE_API_URL to your server's address
docker compose up -d --build
```

This starts:
- Postgres on port 5432 (schema auto-loaded on first run)
- API on port 3001
- Web app (Nginx) on port 8080

Then seed your first admin user inside the running API container:
```
docker compose exec api npx tsx src/seed.ts admin@yourchurch.org yourpassword "Your Name"
```

Put this behind a reverse proxy (e.g. Caddy or Nginx) with a domain and TLS for real use — the containers above are plain HTTP.

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
