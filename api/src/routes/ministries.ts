import { Hono } from "hono";
import { query } from "../db.js";
import type { AuthUser } from "../auth.js";

export const ministryRoutes = new Hono();

ministryRoutes.get("/", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const rows = await query("select * from ministries where organization_id = $1 order by name asc", [orgId]);
  return c.json(rows);
});

ministryRoutes.post("/", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const { name } = await c.req.json();
  const rows = await query(
    "insert into ministries (organization_id, name) values ($1, $2) returning *",
    [orgId, name]
  );
  return c.json(rows[0], 201);
});
