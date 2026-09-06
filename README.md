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

Two ways to expose the web app: **bare IP:port** (below), or **behind Traefik
with a domain + TLS** (next section). Pick one — don't do both on the same box.

### Bare IP:port

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

Assumes Traefik is **already running as its own stack**, discovering containers
via the Docker provider, attached to a shared external network. The committed
`docker-compose.prod.yml` overlay puts the `web` container on that network and
adds one `Host()` router to it (Nginx still handles `/api` internally).

1. `rm -f docker-compose.override.yml` if it exists — on a Traefik box it must
   not be present (whenever `COMPOSE_FILE` isn't picked up it silently wins and
   `web` comes up with no Traefik labels → bare `404 page not found`).
2. Find your Traefik network: `docker network ls` (often `proxy`, `traefik`,
   `web`, or `edge`).
3. In `.env`:
   ```
   COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml
   APP_DOMAIN=belongcms.org
   APP_URL=https://belongcms.org
   TRAEFIK_NETWORK=proxy         # REQUIRED — your Traefik network from step 2
   # optional, defaults shown:
   # TRAEFIK_CERTRESOLVER=letsencrypt
   # TRAEFIK_ENTRYPOINT=websecure
   ```
   `COMPOSE_FILE` makes every bare `docker compose` (run from this directory)
   pick up the overlay. If a deploy script runs `docker compose` from elsewhere
   or under `sudo`, pass `--env-file .env` or the explicit
   `-f docker-compose.yml -f docker-compose.prod.yml` instead.
4. Point the domain's A record at the server, then `docker compose up -d --build`.

Verify after a deploy:
```
docker compose config | grep traefik.enable                 # overlay is merged
docker inspect "$(docker compose ps -q web)" \
  --format '{{json .NetworkSettings.Networks}}'              # web is on your Traefik network
```

Traefik fetches the cert on first request (~1 min). `web` has no published port
in this mode; `db`/`api` still publish 5432/3001 — firewall them or add
`ports: !reset []` overrides if that matters.

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
