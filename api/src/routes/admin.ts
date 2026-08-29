import { Hono } from "hono";
import { z } from "zod";
import { query } from "../db.js";

// Platform-operator tier. Mounted behind requireAuth + requireSuperAdmin in
// index.ts. Unlike every other route module, these queries are intentionally
// NOT scoped to the caller's organization_id — a super-admin sees every org.
export const adminRoutes = new Hono();

const ORG_SELECT = `
  o.id, o.name, o.slug, o.plan_status, o.trial_ends_at, o.current_period_end,
  o.payment_reference, o.payment_submitted_at, o.subscribed_at, o.created_at,
  (select count(*)::int from members m where m.organization_id = o.id) as member_count,
  (select count(*)::int from users u where u.organization_id = o.id) as user_count
`;

// GET /admin/organizations?status=pending_review|trialing|active|canceled
adminRoutes.get("/organizations", async (c) => {
  const status = c.req.query("status");
  const params: any[] = [];
  let where = "";
  if (status) {
    params.push(status);
    where = `where o.plan_status = $1`;
  }

  const rows = await query(
    `select ${ORG_SELECT}
     from organizations o
     ${where}
     order by
       case o.plan_status
         when 'pending_review' then 0
         when 'trialing' then 1
         when 'active' then 2
         else 3
       end,
       o.created_at desc`,
    params
  );

  const counts = await query<{ plan_status: string; count: number }>(
    "select plan_status, count(*)::int as count from organizations group by plan_status"
  );

  return c.json({
    data: rows,
    counts: Object.fromEntries(counts.map((r) => [r.plan_status, r.count])),
  });
});

async function updatedOrg(id: string) {
  const rows = await query(
    `select ${ORG_SELECT} from organizations o where o.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

const activateSchema = z.object({ months: z.number().int().min(1).max(24).default(1) });

// POST /admin/organizations/:id/activate { months? } — verify a payment: mark
// active and extend the paid-through date by `months` (default 1).
//   - A lapsed / never-activated org starts its month(s) from now (payment
//     receipt), via greatest(current_period_end, now()).
//   - An org still inside a paid period stacks the new months on top of its
//     existing end date, so paying early or paying several months ahead never
//     loses days.
adminRoutes.post("/organizations/:id/activate", async (c) => {
  const id = c.req.param("id");
  let months = 1;
  try {
    // Body is optional; treat a missing/empty body as { months: 1 }.
    const raw = await c.req.json().catch(() => ({}));
    months = activateSchema.parse(raw ?? {}).months;
  } catch {
    return c.json({ error: "months must be a whole number between 1 and 24" }, 400);
  }

  const rows = await query<{ id: string }>(
    `update organizations
     set plan_status = 'active',
         subscribed_at = coalesce(subscribed_at, now()),
         current_period_end = greatest(current_period_end, now()) + make_interval(months => $2::int)
     where id = $1
     returning id`,
    [id, months]
  );
  if (!rows[0]) return c.json({ error: "Organization not found" }, 404);
  return c.json(await updatedOrg(id));
});

const extendSchema = z.object({ days: z.number().int().min(1).max(90) });

// POST /admin/organizations/:id/extend-trial { days } — push trial_ends_at out
// and put the org back into 'trialing'. Extends from whichever is later: the
// current end date or now.
adminRoutes.post("/organizations/:id/extend-trial", async (c) => {
  const id = c.req.param("id");
  let body: z.infer<typeof extendSchema>;
  try {
    body = extendSchema.parse(await c.req.json());
  } catch {
    return c.json({ error: "days must be a whole number between 1 and 90" }, 400);
  }

  const rows = await query<{ id: string }>(
    `update organizations
     set trial_ends_at = greatest(trial_ends_at, now()) + make_interval(days => $2::int),
         plan_status = 'trialing'
     where id = $1
     returning id`,
    [id, body.days]
  );
  if (!rows[0]) return c.json({ error: "Organization not found" }, 404);
  return c.json(await updatedOrg(id));
});

// POST /admin/organizations/:id/cancel — stop access at the next gate check.
adminRoutes.post("/organizations/:id/cancel", async (c) => {
  const id = c.req.param("id");
  const rows = await query<{ id: string }>(
    "update organizations set plan_status = 'canceled' where id = $1 returning id",
    [id]
  );
  if (!rows[0]) return c.json({ error: "Organization not found" }, 404);
  return c.json(await updatedOrg(id));
});
