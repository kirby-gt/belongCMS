import bcrypt from "bcryptjs";
import { pool, query } from "./db.js";

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] || "Admin";
  const orgName = process.argv[5] || "Test Church";

  if (!email || !password) {
    console.error("Usage: tsx src/seed.ts <email> <password> [name] [organization-name]");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);

  const existingOrg = await query<{ organization_id: string }>(
    "select organization_id from users where email = $1",
    [email]
  );

  let organizationId = existingOrg[0]?.organization_id;
  if (!organizationId) {
    const slug = orgName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "seed-org";
    const org = await query<{ id: string }>(
      `insert into organizations (name, slug, plan_status, trial_ends_at)
       values ($1, $2, 'active', now())
       returning id`,
      [orgName, slug]
    );
    organizationId = org[0].id;
  }

  await query(
    `insert into users (organization_id, name, email, password_hash, role)
     values ($1, $2, $3, $4, 'admin')
     on conflict (email) do update set password_hash = excluded.password_hash`,
    [organizationId, name, email, hash]
  );
  console.log(`Admin user ready: ${email} (organization: ${orgName})`);
  await pool.end();
}

main();
