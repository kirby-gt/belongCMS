import type { Context, Next } from "hono";
import jwt from "jsonwebtoken";
import { query } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";

export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "staff" | "leader";
  organization_id: string;
  is_superadmin?: boolean;
}

export function signToken(user: AuthUser) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}

export async function requireAuth(c: Context, next: Next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const token = header.slice(7);
    const user = jwt.verify(token, JWT_SECRET) as AuthUser;
    c.set("user", user);
    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
}

// Monthly subscription cycle: an org keeps access until current_period_end plus
// this much grace; the renewal reminder starts this long before it. Mirrored in
// the web (SubscriptionGate / ProtectedRoute) — keep the two in sync.
export const RENEWAL_GRACE_DAYS = 5;
export const RENEWAL_REMINDER_DAYS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface OrgAccess {
  plan_status: string;
  trial_ends_at: string;
  current_period_end: string | null;
}

// Single source of truth for "can this org use the app right now".
export function orgHasAccess(org: OrgAccess | undefined, now = Date.now()): boolean {
  if (!org) return false;
  const trialUnexpired =
    (org.plan_status === "trialing" || org.plan_status === "pending_review") &&
    new Date(org.trial_ends_at).getTime() > now;
  if (trialUnexpired) return true;
  return (
    (org.plan_status === "active" || org.plan_status === "pending_review") &&
    org.current_period_end != null &&
    now <= new Date(org.current_period_end).getTime() + RENEWAL_GRACE_DAYS * DAY_MS
  );
}

export async function requireActiveOrg(c: Context, next: Next) {
  const user = c.get("user") as AuthUser;
  const rows = await query<OrgAccess>(
    "select plan_status, trial_ends_at, current_period_end from organizations where id = $1",
    [user.organization_id]
  );
  const org = rows[0];
  if (!orgHasAccess(org)) {
    return c.json(
      {
        error: "subscription_required",
        plan_status: org?.plan_status,
        trial_ends_at: org?.trial_ends_at,
        current_period_end: org?.current_period_end ?? null,
      },
      402
    );
  }
  await next();
}

export function requireRole(...roles: AuthUser["role"][]) {
  return async (c: Context, next: Next) => {
    const user = c.get("user") as AuthUser;
    if (!roles.includes(user.role)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  };
}

// Platform-operator gate for the /admin tier. Re-checks the flag against the DB
// rather than trusting the (up to 7-day-old) JWT claim, so revoking a
// super-admin takes effect immediately. Run after requireAuth.
export async function requireSuperAdmin(c: Context, next: Next) {
  const user = c.get("user") as AuthUser;
  const rows = await query<{ is_superadmin: boolean }>(
    "select is_superadmin from users where id = $1",
    [user.id]
  );
  if (!rows[0]?.is_superadmin) {
    return c.json({ error: "Forbidden" }, 403);
  }
  await next();
}
