import { Hono } from "hono";
import { z } from "zod";
import { query } from "../db.js";
import type { AuthUser } from "../auth.js";

export const ministryRoutes = new Hono();

ministryRoutes.get("/", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  // Count through members (org-filtered) rather than raw member_ministries rows,
  // so a link to another org's member can never show up in this org's counts.
  const rows = await query(
    `select mi.*, count(m.id)::int as member_count
     from ministries mi
     left join member_ministries mm on mm.ministry_id = mi.id
     left join members m on m.id = mm.member_id and m.organization_id = mi.organization_id
     where mi.organization_id = $1
     group by mi.id
     order by mi.name asc`,
    [orgId]
  );
  return c.json(rows);
});

const ministrySchema = z.object({ name: z.string().trim().min(1).max(100) });

ministryRoutes.post("/", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const parsed = ministrySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Ministry name is required (max 100 characters)" }, 400);

  try {
    const rows = await query(
      "insert into ministries (organization_id, name) values ($1, $2) returning *",
      [orgId, parsed.data.name]
    );
    return c.json(rows[0], 201);
  } catch (err: any) {
    if (err?.code === "23505") return c.json({ error: "A ministry with that name already exists" }, 409);
    throw err;
  }
});
