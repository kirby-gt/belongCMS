import { Hono } from "hono";
import { query } from "../db.js";
import type { AuthUser } from "../auth.js";

export const householdRoutes = new Hono();

householdRoutes.get("/", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const rows = await query(
    `select h.*, count(m.id)::int as member_count
     from households h
     left join members m on m.household_id = h.id
     where h.organization_id = $1
     group by h.id
     order by h.name asc`,
    [orgId]
  );
  return c.json(rows);
});

householdRoutes.post("/", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const { name, address } = await c.req.json();
  const rows = await query(
    "insert into households (organization_id, name, address) values ($1, $2, $3) returning *",
    [orgId, name, address ?? null]
  );
  return c.json(rows[0], 201);
});

householdRoutes.get("/:id/members", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const id = c.req.param("id");
  const rows = await query(
    "select * from members where household_id = $1 and organization_id = $2 order by is_head_of_household desc, full_name",
    [id, orgId]
  );
  return c.json(rows);
});
