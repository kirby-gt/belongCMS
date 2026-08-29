import { Hono } from "hono";
import { query, withTransaction } from "../db.js";
import type { AuthUser } from "../auth.js";

// Staff-facing review of visitor self-check-ins. Requires auth + active org
// (wired in index.ts). Every query is scoped to the caller's organization_id.
export const visitorCheckinRoutes = new Hono();

// GET /visitor-checkins?status=new|converted|dismissed  (defaults to all)
visitorCheckinRoutes.get("/", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const status = c.req.query("status");

  const conditions = ["vc.organization_id = $1"];
  const params: any[] = [orgId];
  if (status) {
    params.push(status);
    conditions.push(`vc.status = $${params.length}`);
  }

  const rows = await query(
    `select vc.*, m.full_name as converted_member_name
     from visitor_checkins vc
     left join members m on m.id = vc.converted_member_id
     where ${conditions.join(" and ")}
     order by vc.checked_in_at desc`,
    params
  );

  const newCount = await query<{ count: string }>(
    "select count(*) from visitor_checkins where organization_id = $1 and status = 'new'",
    [orgId]
  );

  return c.json({ data: rows, new_count: parseInt(newCount[0].count) });
});

// POST /visitor-checkins/:id/convert — create a Visitor member from the check-in.
// date_joined is taken from checked_in_at (the auto-recorded entry date).
visitorCheckinRoutes.post("/:id/convert", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const id = c.req.param("id");

  const result = await withTransaction(async (client) => {
    const rows = await client.query(
      "select * from visitor_checkins where id = $1 and organization_id = $2 for update",
      [id, orgId]
    );
    const ci = rows.rows[0];
    if (!ci) return { code: 404 as const, error: "Not found" };
    if (ci.status === "converted") return { code: 409 as const, error: "Already added as a member" };

    const dateJoined = new Date(ci.checked_in_at).toISOString().slice(0, 10);
    const member = await client.query(
      `insert into members
         (organization_id, full_name, phone, email, address, membership_status, date_joined)
       values ($1, $2, $3, $4, $5, 'Visitor', $6)
       returning *`,
      [orgId, ci.full_name, ci.phone, ci.email, ci.address, dateJoined]
    );

    await client.query(
      "update visitor_checkins set status = 'converted', converted_member_id = $1 where id = $2",
      [member.rows[0].id, id]
    );

    return { code: 201 as const, member: member.rows[0] };
  });

  if ("error" in result) return c.json({ error: result.error }, result.code);
  return c.json(result.member, result.code);
});

// POST /visitor-checkins/:id/dismiss — drop a check-in without creating a member.
visitorCheckinRoutes.post("/:id/dismiss", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const id = c.req.param("id");
  const rows = await query<{ id: string }>(
    `update visitor_checkins set status = 'dismissed'
     where id = $1 and organization_id = $2 and status = 'new'
     returning id`,
    [id, orgId]
  );
  if (!rows[0]) return c.json({ error: "Not found or already handled" }, 404);
  return c.json({ ok: true });
});
