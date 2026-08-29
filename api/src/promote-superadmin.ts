import { pool, query } from "./db.js";

// Grant (or revoke) the platform-operator flag on an existing user.
//   npx tsx src/promote-superadmin.ts <email>
//   npx tsx src/promote-superadmin.ts <email> --revoke
async function main() {
  const email = process.argv[2];
  const revoke = process.argv.includes("--revoke");

  if (!email) {
    console.error("Usage: tsx src/promote-superadmin.ts <email> [--revoke]");
    process.exit(1);
  }

  const rows = await query<{ name: string; is_superadmin: boolean }>(
    "update users set is_superadmin = $2 where email = $1 returning name, is_superadmin",
    [email, !revoke]
  );

  if (!rows[0]) {
    console.error(`No user found with email "${email}"`);
    await pool.end();
    process.exit(1);
  }

  console.log(
    `${rows[0].name} (${email}) is ${rows[0].is_superadmin ? "now a super-admin" : "no longer a super-admin"}. ` +
      `They must sign in again for it to take effect in the web app.`
  );
  await pool.end();
}

main();
