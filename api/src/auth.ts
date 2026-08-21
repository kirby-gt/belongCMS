import type { Context, Next } from "hono";
import jwt from "jsonwebtoken";
import { query } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";

export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "staff" | "leader";
  organization_id: string;
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

export async function requireActiveOrg(c: Context, next: Next) {
  const user = c.get("user") as AuthUser;
  const rows = await query<{ plan_status: string; trial_ends_at: string }>(
    "select plan_status, trial_ends_at from organizations where id = $1",
    [user.organization_id]
  );
  const org = rows[0];
  const trialActive = org?.plan_status === "trialing" && new Date(org.trial_ends_at) > new Date();
  if (!org || (org.plan_status !== "active" && !trialActive)) {
    return c.json(
      { error: "subscription_required", plan_status: org?.plan_status, trial_ends_at: org?.trial_ends_at },
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
