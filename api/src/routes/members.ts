import { Hono } from "hono";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import type { AuthUser } from "../auth.js";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import crypto from "node:crypto";

export const memberRoutes = new Hono();

const memberSchema = z.object({
  full_name: z.string().min(1),
  date_of_birth: z.string().optional().nullable(),
  gender: z.enum(["Male", "Female"]).optional().nullable(),
  marital_status: z.enum(["Single", "Married", "Widowed", "Divorced"]).optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  membership_status: z.enum(["Visitor", "New convert", "Member", "Inactive"]).default("Visitor"),
  date_joined: z.string().optional().nullable(),
  baptism_date: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  emergency_contact_name: z.string().optional().nullable(),
  emergency_contact_phone: z.string().optional().nullable(),
  household_id: z.string().uuid().optional().nullable(),
  is_head_of_household: z.boolean().optional(),
  ministry_ids: z.array(z.string().uuid()).optional(),
});

// GET /members?search=&status=&ministry_id=&page=&page_size=
memberRoutes.get("/", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const search = c.req.query("search")?.trim();
  const status = c.req.query("status");
  const ministryId = c.req.query("ministry_id");
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query("page_size") ?? "25")));
  const offset = (page - 1) * pageSize;

  const conditions: string[] = ["m.organization_id = $1"];
  const params: any[] = [orgId];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`m.full_name ilike $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`m.membership_status = $${params.length}`);
  }
  if (ministryId) {
    params.push(ministryId);
    conditions.push(`exists (select 1 from member_ministries mm where mm.member_id = m.id and mm.ministry_id = $${params.length})`);
  }

  const where = `where ${conditions.join(" and ")}`;

  const countRows = await query<{ count: string }>(
    `select count(*) from members m ${where}`,
    params
  );
  const total = parseInt(countRows[0].count);

  params.push(pageSize, offset);
  const rows = await query(
    `select m.*, h.name as household_name
     from members m
     left join households h on h.id = m.household_id
     ${where}
     order by m.full_name asc
     limit $${params.length - 1} offset $${params.length}`,
    params
  );

  return c.json({ data: rows, page, page_size: pageSize, total });
});

memberRoutes.get("/:id", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const id = c.req.param("id");
  const rows = await query(
    `select m.*, h.name as household_name from members m left join households h on h.id = m.household_id
     where m.id = $1 and m.organization_id = $2`,
    [id, orgId]
  );
  if (!rows[0]) return c.json({ error: "Not found" }, 404);

  const ministries = await query(
    `select mi.id, mi.name from ministries mi
     join member_ministries mm on mm.ministry_id = mi.id
     where mm.member_id = $1`,
    [id]
  );
  return c.json({ ...rows[0], ministries });
});

async function filterMinistryIdsForOrg(orgId: string, ministryIds: string[]): Promise<string[]> {
  if (!ministryIds.length) return [];
  const rows = await query<{ id: string }>(
    "select id from ministries where organization_id = $1 and id = any($2)",
    [orgId, ministryIds]
  );
  return rows.map((r) => r.id);
}

async function verifyHouseholdForOrg(orgId: string, householdId: string | null | undefined): Promise<string | null> {
  if (!householdId) return null;
  const rows = await query("select id from households where id = $1 and organization_id = $2", [householdId, orgId]);
  return rows[0] ? householdId : null;
}

memberRoutes.post("/", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const body = memberSchema.parse(await c.req.json());
  const { ministry_ids: rawMinistryIds, ...m } = body;
  const ministry_ids = rawMinistryIds ? await filterMinistryIdsForOrg(orgId, rawMinistryIds) : undefined;
  const householdId = await verifyHouseholdForOrg(orgId, m.household_id);

  const member = await withTransaction(async (client) => {
    const rows = await client.query(
      `insert into members
        (organization_id, full_name, date_of_birth, gender, marital_status, phone, email, address,
         membership_status, date_joined, baptism_date, occupation,
         emergency_contact_name, emergency_contact_phone, household_id, is_head_of_household)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       returning *`,
      [
        orgId, m.full_name, m.date_of_birth ?? null, m.gender ?? null, m.marital_status ?? null,
        m.phone ?? null, m.email ?? null, m.address ?? null, m.membership_status,
        m.date_joined ?? null, m.baptism_date ?? null, m.occupation ?? null,
        m.emergency_contact_name ?? null, m.emergency_contact_phone ?? null,
        householdId, m.is_head_of_household ?? false,
      ]
    );
    const created = rows.rows[0];

    // Seed the status history with the enrolment row (old_status null).
    await client.query(
      `insert into member_status_history (organization_id, member_id, old_status, new_status)
       values ($1, $2, null, $3)`,
      [orgId, created.id, created.membership_status]
    );

    if (ministry_ids?.length) {
      for (const ministryId of ministry_ids) {
        await client.query("insert into member_ministries (member_id, ministry_id) values ($1,$2) on conflict do nothing", [created.id, ministryId]);
      }
    }

    return created;
  });

  return c.json(member, 201);
});

memberRoutes.put("/:id", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const id = c.req.param("id");
  const body = memberSchema.partial().parse(await c.req.json());
  const { ministry_ids: rawMinistryIds, ...m } = body;
  const ministry_ids = rawMinistryIds ? await filterMinistryIdsForOrg(orgId, rawMinistryIds) : undefined;
  if ("household_id" in m) {
    (m as any).household_id = await verifyHouseholdForOrg(orgId, m.household_id);
  }

  const updated = await withTransaction(async (client) => {
    // If this update touches membership_status, capture the prior value first so
    // a genuine change can be logged to member_status_history.
    let priorStatus: string | undefined;
    if ("membership_status" in m) {
      const cur = await client.query<{ membership_status: string }>(
        "select membership_status from members where id = $1 and organization_id = $2",
        [id, orgId]
      );
      priorStatus = cur.rows[0]?.membership_status;
    }

    const fields = Object.keys(m);
    if (fields.length) {
      const setClause = fields.map((f, i) => `${f} = $${i + 3}`).join(", ");
      await client.query(
        `update members set ${setClause}, updated_at = now() where id = $1 and organization_id = $2`,
        [id, orgId, ...fields.map((f) => (m as any)[f])]
      );
    }

    if (
      "membership_status" in m &&
      priorStatus !== undefined &&
      (m as any).membership_status !== priorStatus
    ) {
      await client.query(
        `insert into member_status_history (organization_id, member_id, old_status, new_status)
         values ($1, $2, $3, $4)`,
        [orgId, id, priorStatus, (m as any).membership_status]
      );
    }

    if (ministry_ids) {
      await client.query("delete from member_ministries where member_id = $1", [id]);
      for (const ministryId of ministry_ids) {
        await client.query("insert into member_ministries (member_id, ministry_id) values ($1,$2) on conflict do nothing", [id, ministryId]);
      }
    }

    const rows = await client.query("select * from members where id = $1 and organization_id = $2", [id, orgId]);
    return rows.rows[0];
  });

  return c.json(updated);
});

memberRoutes.delete("/:id", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const id = c.req.param("id");
  await query("delete from members where id = $1 and organization_id = $2", [id, orgId]);
  return c.json({ ok: true });
});

memberRoutes.post("/:id/photo", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const id = c.req.param("id");

  const members = await query("select id from members where id = $1 and organization_id = $2", [id, orgId]);
  if (!members[0]) return c.json({ error: "Not found" }, 404);

  const formData = await c.req.parseBody();
  const photo = formData["photo"];

  if (!photo || typeof photo === "string") {
    return c.json({ error: "No photo provided" }, 400);
  }

  const uploadDir = join("uploads", orgId);
  await mkdir(uploadDir, { recursive: true });

  const ext = photo.name.includes(".") ? `.${photo.name.split(".").pop()}` : "";
  const fileName = `${crypto.randomUUID()}${ext}`;
  const filePath = join(uploadDir, fileName);

  const arrayBuffer = await photo.arrayBuffer();
  await writeFile(filePath, Buffer.from(arrayBuffer));

  const photoUrl = `/uploads/${orgId}/${fileName}`;

  await query("update members set photo_url = $1, updated_at = now() where id = $2 and organization_id = $3", [photoUrl, id, orgId]);

  return c.json({ photo_url: photoUrl });
});

// Bulk import from parsed CSV rows.
// Each row may include household_name and ministries (comma- or semicolon-separated names)
// instead of ids — these get resolved/created automatically.
const importRowSchema = z.object({
  full_name: z.string().min(1),
  date_of_birth: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  marital_status: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  membership_status: z.string().optional().nullable(),
  date_joined: z.string().optional().nullable(),
  baptism_date: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  emergency_contact_name: z.string().optional().nullable(),
  emergency_contact_phone: z.string().optional().nullable(),
  household_name: z.string().optional().nullable(),
  ministries: z.string().optional().nullable(), // comma- or semicolon-separated
});

const VALID_STATUSES = ["Visitor", "New convert", "Member", "Inactive"];
const VALID_GENDERS = ["Male", "Female"];
const VALID_MARITAL = ["Single", "Married", "Widowed", "Divorced"];

// Common synonyms seen in real-world exports that don't match VALID_STATUSES exactly.
const STATUS_ALIASES: Record<string, string> = {
  "regular attender": "Visitor",
  "attender": "Visitor",
  "leader": "Member",
};

function resolveStatus(raw: string | null | undefined): string {
  if (raw && VALID_STATUSES.includes(raw)) return raw;
  const alias = raw && STATUS_ALIASES[raw.trim().toLowerCase()];
  return alias || "Visitor";
}

// Placeholder text spreadsheets commonly use for "no value" instead of leaving the cell blank.
const BLANK_TOKENS = new Set(["no household", "none", "n/a", "na", "-", "not applicable"]);

async function resolveHousehold(orgId: string, name: string | null | undefined): Promise<string | null> {
  if (!name?.trim() || BLANK_TOKENS.has(name.trim().toLowerCase())) return null;
  const trimmed = name.trim();
  const existing = await query<{ id: string }>(
    "select id from households where organization_id = $1 and lower(name) = lower($2)",
    [orgId, trimmed]
  );
  if (existing[0]) return existing[0].id;
  const created = await query<{ id: string }>(
    "insert into households (organization_id, name) values ($1, $2) returning id",
    [orgId, trimmed]
  );
  return created[0].id;
}

async function resolveMinistryIds(orgId: string, namesCsv: string | null | undefined): Promise<string[]> {
  if (!namesCsv?.trim()) return [];
  const names = namesCsv.split(/[,;]/).map((n) => n.trim()).filter(Boolean);
  const ids: string[] = [];
  for (const name of names) {
    const existing = await query<{ id: string }>(
      "select id from ministries where organization_id = $1 and lower(name) = lower($2)",
      [orgId, name]
    );
    if (existing[0]) {
      ids.push(existing[0].id);
    } else {
      const created = await query<{ id: string }>(
        "insert into ministries (organization_id, name) values ($1, $2) returning id",
        [orgId, name]
      );
      ids.push(created[0].id);
    }
  }
  return ids;
}

memberRoutes.post("/import", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const body = await c.req.json();
  const rows = body.rows as any[];
  if (!Array.isArray(rows) || rows.length === 0) {
    return c.json({ error: "No rows provided" }, 400);
  }

  const results: { row: number; name?: string; status: "created" | "error"; message?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i];
    try {
      const row = importRowSchema.parse(rawRow);

      const gender = VALID_GENDERS.includes(row.gender ?? "") ? row.gender : null;
      const marital = VALID_MARITAL.includes(row.marital_status ?? "") ? row.marital_status : null;
      const status = resolveStatus(row.membership_status);

      const householdId = await resolveHousehold(orgId, row.household_name);
      const ministryIds = await resolveMinistryIds(orgId, row.ministries);

      const inserted = await query<{ id: string }>(
        `insert into members
          (organization_id, full_name, date_of_birth, gender, marital_status, phone, email, address,
           membership_status, date_joined, baptism_date, occupation,
           emergency_contact_name, emergency_contact_phone, household_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         returning id`,
        [
          orgId, row.full_name, row.date_of_birth || null, gender, marital,
          row.phone || null, row.email || null, row.address || null, status,
          row.date_joined || null, row.baptism_date || null, row.occupation || null,
          row.emergency_contact_name || null, row.emergency_contact_phone || null,
          householdId,
        ]
      );

      await query(
        `insert into member_status_history (organization_id, member_id, old_status, new_status)
         values ($1, $2, null, $3)`,
        [orgId, inserted[0].id, status]
      );

      for (const ministryId of ministryIds) {
        await query("insert into member_ministries (member_id, ministry_id) values ($1,$2) on conflict do nothing", [
          inserted[0].id,
          ministryId,
        ]);
      }

      results.push({ row: i + 1, name: row.full_name, status: "created" });
    } catch (err: any) {
      results.push({
        row: i + 1,
        name: rawRow?.full_name,
        status: "error",
        message: err?.errors?.[0]?.message || err?.message || "Unknown error",
      });
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const errors = results.filter((r) => r.status === "error");
  return c.json({ created, error_count: errors.length, results });
});
