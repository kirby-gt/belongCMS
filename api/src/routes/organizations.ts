import { Hono } from "hono";
import { z } from "zod";
import { query } from "../db.js";
import type { AuthUser } from "../auth.js";

export const organizationRoutes = new Hono();

organizationRoutes.get("/me", async (c) => {
  const user = c.get("user") as AuthUser;
  const rows = await query(
    `select id, name, slug, plan_status, trial_ends_at, payment_reference, payment_submitted_at, subscribed_at, created_at
     from organizations where id = $1`,
    [user.organization_id]
  );
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  return c.json(rows[0]);
});

const subscribeSchema = z.object({
  payment_reference: z.string().min(1),
});

organizationRoutes.post("/subscribe", async (c) => {
  const user = c.get("user") as AuthUser;
  const body = subscribeSchema.parse(await c.req.json());

  const rows = await query(
    `update organizations
     set plan_status = 'pending_review', payment_reference = $2, payment_submitted_at = now()
     where id = $1
     returning id, name, slug, plan_status, trial_ends_at, payment_reference, payment_submitted_at, subscribed_at`,
    [user.organization_id, body.payment_reference]
  );
  return c.json(rows[0]);
});
