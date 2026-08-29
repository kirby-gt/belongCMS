import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { query } from "../db.js";

// Unauthenticated visitor self-check-in. Reached by scanning an organization's
// QR code, which encodes /welcome/:token on the web app; the web app then calls
// these endpoints with that token. No JWT is involved.
export const publicRoutes = new Hono();

// --- Naive per-process, per-IP rate limit -------------------------------------
// Enough to blunt casual abuse of the public endpoint. A multi-instance
// deployment would need a shared store (Redis) for this to be exact.
const MAX_PER_WINDOW = 6;
const WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_PER_WINDOW;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of hits) if (now > rec.resetAt) hits.delete(ip);
}, WINDOW_MS).unref();

function clientIp(c: Context): string {
  const fwd = c.req.header("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return c.req.header("x-real-ip") || "unknown";
}

// Resolve a token to an organization, but only if intake is enabled AND the org's
// subscription is live (don't collect data for churches that aren't customers).
async function orgForToken(token: string) {
  const rows = await query<{
    id: string;
    name: string;
    plan_status: string;
    trial_ends_at: string;
    public_intake_enabled: boolean;
  }>(
    `select id, name, plan_status, trial_ends_at, public_intake_enabled
     from organizations where public_intake_token = $1`,
    [token]
  );
  const org = rows[0];
  if (!org || !org.public_intake_enabled) return null;
  const trialActive = org.plan_status === "trialing" && new Date(org.trial_ends_at) > new Date();
  if (org.plan_status !== "active" && !trialActive) return null;
  return org;
}

// GET /public/checkin/:token — just enough for the form to greet the visitor.
publicRoutes.get("/checkin/:token", async (c) => {
  const org = await orgForToken(c.req.param("token"));
  if (!org) return c.json({ error: "This check-in link is not active." }, 404);
  return c.json({ organization_name: org.name });
});

const checkinSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(200).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  first_time: z.boolean().optional().nullable(),
  prayer_request: z.string().trim().max(2000).optional().nullable(),
  // Honeypot: a hidden field real users never see or fill. Accept any value here
  // so the request still parses — it's handled (silently) after parsing.
  company: z.string().max(200).optional(),
});

// POST /public/checkin/:token — record a visitor. checked_in_at is set by the DB.
publicRoutes.post("/checkin/:token", async (c) => {
  if (rateLimited(clientIp(c))) {
    return c.json({ error: "Too many submissions. Please try again in a minute." }, 429);
  }

  const org = await orgForToken(c.req.param("token"));
  if (!org) return c.json({ error: "This check-in link is not active." }, 404);

  let body: z.infer<typeof checkinSchema>;
  try {
    body = checkinSchema.parse(await c.req.json());
  } catch {
    return c.json({ error: "Please check the form and try again." }, 400);
  }

  // Honeypot tripped — act successful, store nothing.
  if (body.company) return c.json({ ok: true });

  await query(
    `insert into visitor_checkins
       (organization_id, full_name, phone, email, address, first_time, prayer_request)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      org.id,
      body.full_name,
      body.phone || null,
      body.email || null,
      body.address || null,
      body.first_time ?? null,
      body.prayer_request || null,
    ]
  );

  return c.json({ ok: true });
});
