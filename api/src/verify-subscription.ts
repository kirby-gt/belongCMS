import { pool, query } from "./db.js";

async function main() {
  const identifier = process.argv[2];

  if (!identifier) {
    console.error("Usage: tsx src/verify-subscription.ts <admin-email-or-organization-id>");
    process.exit(1);
  }

  const isUuid = /^[0-9a-f-]{36}$/i.test(identifier);

  const orgId = isUuid
    ? identifier
    : (
        await query<{ organization_id: string }>("select organization_id from users where email = $1", [identifier])
      )[0]?.organization_id;

  if (!orgId) {
    console.error(`No organization found for "${identifier}"`);
    await pool.end();
    process.exit(1);
  }

  // Mirror POST /admin/organizations/:id/activate: mark active and advance the
  // monthly period (a null current_period_end would otherwise fail orgHasAccess).
  const rows = await query<{ name: string; current_period_end: string }>(
    `update organizations
     set plan_status = 'active',
         subscribed_at = coalesce(subscribed_at, now()),
         current_period_end = greatest(current_period_end, now()) + interval '1 month'
     where id = $1
     returning name, current_period_end`,
    [orgId]
  );

  if (!rows[0]) {
    console.error(`No organization found with id ${orgId}`);
    await pool.end();
    process.exit(1);
  }

  console.log(
    `Subscription activated for "${rows[0].name}" (${orgId}); paid through ${rows[0].current_period_end}`
  );
  await pool.end();
}

main();
