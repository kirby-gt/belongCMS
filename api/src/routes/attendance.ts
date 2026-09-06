import { Hono } from "hono";
import { z } from "zod";
import { query } from "../db.js";
import type { AuthUser } from "../auth.js";

export const attendanceRoutes = new Hono();

const SERVICE_TYPES = ["Sunday", "Midweek", "Special"] as const;

const serviceSchema = z.object({
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "service_date must be YYYY-MM-DD"),
  service_type: z.enum(SERVICE_TYPES).default("Sunday"),
  name: z.string().trim().max(120).optional().nullable(),
});

const servicePatchSchema = z.object({
  service_type: z.enum(SERVICE_TYPES).optional(),
  name: z.string().trim().max(120).optional().nullable(),
  visitor_count: z.number().int().min(0).max(1_000_000).optional().nullable(),
});

// Per-service computed figures, kept as scalar subqueries so joining attendance
// and visitor_checkins in one query can't fan out and inflate the counts.
// - present: members marked present
// - visitors_present: of those present, how many are still membership_status 'Visitor'
// - visitor_checkins: public QR self-check-ins submitted on the service's calendar date
export const SERVICE_FIGURES = `
  (select count(*) from attendance a where a.service_id = s.id and a.present)::int as present,
  (select count(*) from attendance a
     join members m on m.id = a.member_id
    where a.service_id = s.id and a.present and m.membership_status = 'Visitor')::int as visitors_present,
  (select count(*) from visitor_checkins vc
    where vc.organization_id = s.organization_id
      and vc.checked_in_at::date = s.service_date)::int as visitor_checkins
`;

// Create or fetch a service for a given date/type. An event name can be supplied
// on creation (or updated here if the service already exists).
attendanceRoutes.post("/services", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const body = serviceSchema.parse(await c.req.json());
  const name = body.name?.trim() || null;

  const existing = await query<{ id: string; name: string | null }>(
    "select id, name from services where organization_id = $1 and service_date = $2 and service_type = $3",
    [orgId, body.service_date, body.service_type]
  );
  if (existing[0]) {
    if (name !== null && name !== existing[0].name) {
      await query("update services set name = $1 where id = $2 and organization_id = $3", [name, existing[0].id, orgId]);
    }
    const rows = await query("select * from services where id = $1", [existing[0].id]);
    return c.json(rows[0]);
  }

  const rows = await query(
    "insert into services (organization_id, service_date, service_type, name) values ($1, $2, $3, $4) returning *",
    [orgId, body.service_date, body.service_type, name]
  );
  return c.json(rows[0], 201);
});

attendanceRoutes.get("/services", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const rows = await query(
    `select s.*, ${SERVICE_FIGURES}
     from services s
     where s.organization_id = $1
     order by s.service_date desc
     limit 50`,
    [orgId]
  );
  return c.json(rows);
});

// Rename a service, change its type, or record a manual visitor headcount.
attendanceRoutes.patch("/services/:serviceId", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const serviceId = c.req.param("serviceId");
  const body = servicePatchSchema.parse(await c.req.json());

  const patch: Record<string, unknown> = {};
  if ("service_type" in body && body.service_type !== undefined) patch.service_type = body.service_type;
  if ("name" in body) patch.name = body.name?.trim() || null;
  if ("visitor_count" in body) patch.visitor_count = body.visitor_count ?? null;

  const fields = Object.keys(patch);
  if (!fields.length) {
    const rows = await query("select * from services where id = $1 and organization_id = $2", [serviceId, orgId]);
    if (!rows[0]) return c.json({ error: "Not found" }, 404);
    return c.json(rows[0]);
  }

  const setClause = fields.map((f, i) => `${f} = $${i + 3}`).join(", ");
  const rows = await query(
    `update services set ${setClause} where id = $1 and organization_id = $2 returning *`,
    [serviceId, orgId, ...fields.map((f) => patch[f])]
  );
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  return c.json(rows[0]);
});

attendanceRoutes.delete("/services/:serviceId", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const serviceId = c.req.param("serviceId");
  const rows = await query<{ id: string }>(
    "delete from services where id = $1 and organization_id = $2 returning id",
    [serviceId, orgId]
  );
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// Check in / mark present for a member at a service
attendanceRoutes.post("/services/:serviceId/checkin", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const serviceId = c.req.param("serviceId");
  const { member_id, present } = await c.req.json();

  const service = await query("select id from services where id = $1 and organization_id = $2", [serviceId, orgId]);
  if (!service[0]) return c.json({ error: "Not found" }, 404);
  const member = await query("select id from members where id = $1 and organization_id = $2", [member_id, orgId]);
  if (!member[0]) return c.json({ error: "Member not found" }, 404);

  const rows = await query(
    `insert into attendance (organization_id, service_id, member_id, present)
     values ($1, $2, $3, $4)
     on conflict (service_id, member_id) do update set present = excluded.present
     returning *`,
    [orgId, serviceId, member_id, present ?? true]
  );
  return c.json(rows[0]);
});

// One service with its computed present/visitor figures.
attendanceRoutes.get("/services/:serviceId/summary", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const serviceId = c.req.param("serviceId");
  const rows = await query(
    `select s.id, to_char(s.service_date, 'YYYY-MM-DD') as service_date, s.service_type, s.name,
       s.visitor_count, ${SERVICE_FIGURES}
     from services s
     where s.id = $1 and s.organization_id = $2`,
    [serviceId, orgId]
  );
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  return c.json(rows[0]);
});

attendanceRoutes.get("/services/:serviceId/attendance", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const serviceId = c.req.param("serviceId");
  const rows = await query(
    `select m.id as member_id, m.full_name, m.membership_status, coalesce(a.present, false) as present
     from members m
     left join attendance a on a.member_id = m.id and a.service_id = $1
     where m.organization_id = $2
     order by m.full_name asc`,
    [serviceId, orgId]
  );
  return c.json(rows);
});

export interface MonthlyServiceRow {
  id: string;
  service_date: string;
  service_type: string;
  name: string | null;
  visitor_count: number | null;
  present: number;
  visitors_present: number;
  visitor_checkins: number;
}

// GET /attendance/monthly-summary?month=YYYY-MM  (defaults to the current month)
// Average attendance is taken over services that actually had attendance recorded,
// so a service created but never checked-in doesn't drag the average to zero.
attendanceRoutes.get("/monthly-summary", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthParam = c.req.query("month");
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonth;
  const startDate = `${month}-01`;

  const services = await query<MonthlyServiceRow>(
    `select s.id, to_char(s.service_date, 'YYYY-MM-DD') as service_date, s.service_type, s.name,
       s.visitor_count, ${SERVICE_FIGURES}
     from services s
     where s.organization_id = $1
       and s.service_date >= $2::date
       and s.service_date < ($2::date + interval '1 month')
     order by s.service_date asc`,
    [orgId, startDate]
  );

  const isSunday = (t: string) => t.toLowerCase() === "sunday";
  const attended = services.filter((s) => s.present > 0);
  const sundayAttended = attended.filter((s) => isSunday(s.service_type));

  const avg = (rows: MonthlyServiceRow[]) =>
    rows.length ? Math.round(rows.reduce((sum, s) => sum + s.present, 0) / rows.length) : null;

  // Per-service visitor figure: the manual headcount when entered, else the QR
  // self-check-in count for that day.
  const serviceVisitors = (s: MonthlyServiceRow) => s.visitor_count ?? s.visitor_checkins;

  return c.json({
    month,
    service_count: services.length,
    attended_service_count: attended.length,
    total_present: attended.reduce((sum, s) => sum + s.present, 0),
    average_attendance: avg(attended),
    sunday_service_count: sundayAttended.length,
    sunday_average_attendance: avg(sundayAttended),
    total_visitors: services.reduce((sum, s) => sum + serviceVisitors(s), 0),
    visitor_breakdown: {
      manual: services.reduce((sum, s) => sum + (s.visitor_count ?? 0), 0),
      checkins: services.reduce((sum, s) => sum + s.visitor_checkins, 0),
      visitor_status_present: services.reduce((sum, s) => sum + s.visitors_present, 0),
    },
    services,
  });
});
