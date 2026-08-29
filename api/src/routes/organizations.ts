import { Hono } from "hono";
import { z } from "zod";
import crypto from "node:crypto";
import { query } from "../db.js";
import type { AuthUser } from "../auth.js";

export const organizationRoutes = new Hono();

organizationRoutes.get("/me", async (c) => {
  const user = c.get("user") as AuthUser;
  const rows = await query(
    `select id, name, slug, plan_status, trial_ends_at, current_period_end,
            payment_reference, payment_submitted_at, subscribed_at, created_at,
            public_intake_token, public_intake_enabled
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

// --- Public visitor check-in (QR code) settings ---

// Regenerate the intake token; any previously printed QR code / link stops working.
organizationRoutes.post("/intake/rotate", async (c) => {
  const user = c.get("user") as AuthUser;
  const rows = await query(
    `update organizations set public_intake_token = $2 where id = $1
     returning public_intake_token, public_intake_enabled`,
    [user.organization_id, crypto.randomBytes(16).toString("hex")]
  );
  return c.json(rows[0]);
});

const intakeToggleSchema = z.object({ enabled: z.boolean() });

organizationRoutes.post("/intake/toggle", async (c) => {
  const user = c.get("user") as AuthUser;
  const { enabled } = intakeToggleSchema.parse(await c.req.json());
  const rows = await query(
    `update organizations set public_intake_enabled = $2 where id = $1
     returning public_intake_token, public_intake_enabled`,
    [user.organization_id, enabled]
  );
  return c.json(rows[0]);
});
