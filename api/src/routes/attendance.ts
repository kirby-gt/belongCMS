import { Hono } from "hono";
import { query } from "../db.js";
import type { AuthUser } from "../auth.js";

export const attendanceRoutes = new Hono();

// Create or fetch a service for a given date/type
attendanceRoutes.post("/services", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const { service_date, service_type } = await c.req.json();
  const existing = await query(
    "select * from services where organization_id = $1 and service_date = $2 and service_type = $3",
    [orgId, service_date, service_type ?? "Sunday"]
  );
  if (existing[0]) return c.json(existing[0]);

  const rows = await query(
    "insert into services (organization_id, service_date, service_type) values ($1, $2, $3) returning *",
    [orgId, service_date, service_type ?? "Sunday"]
  );
  return c.json(rows[0], 201);
});

attendanceRoutes.get("/services", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const rows = await query(
    "select * from services where organization_id = $1 order by service_date desc limit 50",
    [orgId]
  );
  return c.json(rows);
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

attendanceRoutes.get("/services/:serviceId/attendance", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const serviceId = c.req.param("serviceId");
  const rows = await query(
    `select m.id as member_id, m.full_name, coalesce(a.present, false) as present
     from members m
     left join attendance a on a.member_id = m.id and a.service_id = $1
     where m.organization_id = $2
     order by m.full_name asc`,
    [serviceId, orgId]
  );
  return c.json(rows);
});
