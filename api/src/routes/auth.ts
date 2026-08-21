import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { signToken } from "../auth.js";
import crypto from "node:crypto";

export const authRoutes = new Hono();

const TRIAL_DAYS = 14;

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "church"
  );
}

authRoutes.post("/login", async (c) => {
  const { email, password } = await c.req.json();
  const rows = await query<{
    id: string;
    email: string;
    password_hash: string;
    role: "admin" | "staff" | "leader";
    name: string;
    organization_id: string;
  }>(
    "select id, email, password_hash, role, name, organization_id from users where email = $1",
    [email]
  );
  const user = rows[0];
  if (!user) return c.json({ error: "Invalid email or password" }, 401);

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return c.json({ error: "Invalid email or password" }, 401);

  const token = signToken({ id: user.id, email: user.email, role: user.role, organization_id: user.organization_id });
  return c.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, organization_id: user.organization_id },
  });
});

const signupSchema = z.object({
  organization_name: z.string().min(1),
  admin_name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

authRoutes.post("/signup", async (c) => {
  const body = signupSchema.parse(await c.req.json());

  const existing = await query("select id from users where email = $1", [body.email]);
  if (existing[0]) return c.json({ error: "An account with that email already exists" }, 409);

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const baseSlug = slugify(body.organization_name);
  const passwordHash = await bcrypt.hash(body.password, 10);

  const result = await withTransaction(async (client) => {
    let slug = baseSlug;
    let suffix = 1;
    // Resolve slug collisions inside the transaction to avoid a race with a concurrent signup.
    while (true) {
      const clash = await client.query("select 1 from organizations where slug = $1", [slug]);
      if (clash.rows.length === 0) break;
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    const orgRows = await client.query(
      `insert into organizations (name, slug, plan_status, trial_ends_at)
       values ($1, $2, 'trialing', $3)
       returning id`,
      [body.organization_name, slug, trialEndsAt]
    );
    const organizationId = orgRows.rows[0].id;

    const userRows = await client.query(
      `insert into users (organization_id, name, email, password_hash, role)
       values ($1, $2, $3, $4, 'admin')
       returning id, name, email, role, organization_id`,
      [organizationId, body.admin_name, body.email, passwordHash]
    );

    return userRows.rows[0];
  });

  const token = signToken({
    id: result.id,
    email: result.email,
    role: result.role,
    organization_id: result.organization_id,
  });
  return c.json({ token, user: result }, 201);
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

authRoutes.post("/forgot-password", async (c) => {
  const { email } = forgotPasswordSchema.parse(await c.req.json());
  
  const user = await query<{ id: string }>("select id from users where email = $1", [email]);
  
  if (user[0]) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    await query(
      "insert into password_resets (user_id, token, expires_at) values ($1, $2, $3)",
      [user[0].id, token, expiresAt]
    );
    
    console.log(`[EMAIL MOCK] Password reset link for ${email}: http://localhost:5173/reset-password?token=${token}`);
  }
  
  return c.json({ ok: true });
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

authRoutes.post("/reset-password", async (c) => {
  const { token, password } = resetPasswordSchema.parse(await c.req.json());
  
  const resetRows = await query<{ user_id: string }>(
    "select user_id from password_resets where token = $1 and used = false and expires_at > now()",
    [token]
  );
  
  const reset = resetRows[0];
  if (!reset) {
    return c.json({ error: "Invalid or expired reset token" }, 400);
  }
  
  const passwordHash = await bcrypt.hash(password, 10);
  
  await withTransaction(async (client) => {
    await client.query("update users set password_hash = $1 where id = $2", [passwordHash, reset.user_id]);
    await client.query("update password_resets set used = true where token = $1", [token]);
  });
  
  return c.json({ ok: true });
});
