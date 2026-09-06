import { Hono } from "hono";
import { query } from "../db.js";
import type { AuthUser } from "../auth.js";
import { SERVICE_FIGURES, type MonthlyServiceRow } from "./attendance.js";

export const reportRoutes = new Hono();

const STATUSES = ["Visitor", "New convert", "Member", "Inactive"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Attendance summary — totals & averages by service type over a date range,
// with the same figures for the immediately preceding range of equal length.
// Averages are taken over services that actually had attendance recorded, so a
// service created but never checked in doesn't drag the average to zero
// (mirrors GET /attendance/monthly-summary).
// ---------------------------------------------------------------------------
type SummaryRow = MonthlyServiceRow & { period: "current" | "previous" };

function summarize(rows: MonthlyServiceRow[]) {
  const attended = rows.filter((s) => s.present > 0);
  const sunday = attended.filter((s) => s.service_type.toLowerCase() === "sunday");
  const avg = (rs: MonthlyServiceRow[]) =>
    rs.length ? Math.round(rs.reduce((sum, s) => sum + s.present, 0) / rs.length) : null;
  return {
    service_count: rows.length,
    attended_service_count: attended.length,
    total_present: attended.reduce((sum, s) => sum + s.present, 0),
    average_attendance: avg(attended),
    sunday_service_count: sunday.length,
    sunday_average_attendance: avg(sunday),
    total_visitors: rows.reduce((sum, s) => sum + (s.visitor_count ?? s.visitor_checkins), 0),
  };
}

reportRoutes.get("/attendance-summary", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const start = c.req.query("start");
  const end = c.req.query("end");
  if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end) || start > end) {
    return c.json({ error: "start and end are required as YYYY-MM-DD, with start <= end" }, 400);
  }

  // Preceding range: same number of days, ending the day before `start`.
  const startD = new Date(`${start}T00:00:00Z`);
  const endD = new Date(`${end}T00:00:00Z`);
  // `new Date` silently rolls invalid days over (2027-02-29 -> 2027-03-01), so
  // round-trip through ISO and require it to match the input before it reaches
  // Postgres (which would 500 on a bad ::date cast).
  if (
    Number.isNaN(startD.getTime()) ||
    Number.isNaN(endD.getTime()) ||
    startD.toISOString().slice(0, 10) !== start ||
    endD.toISOString().slice(0, 10) !== end
  ) {
    return c.json({ error: "start and end must be real calendar dates" }, 400);
  }
  const prevEndD = new Date(startD.getTime() - 86_400_000);
  const prevStartD = new Date(prevEndD.getTime() - (endD.getTime() - startD.getTime()));
  const prevStart = isoDate(prevStartD);
  const prevEnd = isoDate(prevEndD);

  const rows = await query<SummaryRow>(
    `select
       case when s.service_date >= $2::date then 'current' else 'previous' end as period,
       s.id, to_char(s.service_date, 'YYYY-MM-DD') as service_date, s.service_type, s.name,
       s.visitor_count, ${SERVICE_FIGURES}
     from services s
     where s.organization_id = $1
       and s.service_date >= $3::date
       and s.service_date <= $4::date
     order by s.service_date asc`,
    [orgId, start, prevStart, end]
  );

  const current = rows.filter((r) => r.period === "current");
  const previous = rows.filter((r) => r.period === "previous");

  return c.json({
    generated_at: new Date().toISOString(),
    start,
    end,
    compare: { start: prevStart, end: prevEnd },
    summary: summarize(current),
    compare_summary: summarize(previous),
    services: current,
  });
});

// ---------------------------------------------------------------------------
// Absentee / at-risk list — members matching the status/ministry filter whose
// most recent recorded attendance is older than `weeks` weeks, and who have
// been present at least once (so genuinely new / never-attended members don't
// show up here — this is a "used to come, stopped" list).
// ---------------------------------------------------------------------------
reportRoutes.get("/absentees", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;

  const weeksRaw = parseInt(c.req.query("weeks") ?? "6", 10);
  const weeks = Number.isFinite(weeksRaw) ? Math.min(104, Math.max(1, weeksRaw)) : 6;
  const days = weeks * 7;

  const statusParam = c.req.query("status");
  const statuses = statusParam
    ? statusParam.split(",").map((s) => s.trim()).filter((s) => (STATUSES as readonly string[]).includes(s))
    : ["Member", "New convert"];
  if (statuses.length === 0) {
    return c.json({ error: "status must be one or more of: " + STATUSES.join(", ") }, 400);
  }

  const ministryId = c.req.query("ministry_id");

  const params: any[] = [orgId, days, statuses];
  let ministryClause = "";
  if (ministryId) {
    params.push(ministryId);
    ministryClause = `and exists (select 1 from member_ministries mmf where mmf.member_id = m.id and mmf.ministry_id = $${params.length})`;
  }

  const rows = await query(
    `with last_seen as (
       select a.member_id, max(s.service_date) as last_date
       from attendance a
       join services s on s.id = a.service_id
       where a.organization_id = $1 and a.present
       group by a.member_id
     )
     select m.id, m.full_name, m.membership_status, m.phone, m.email,
       to_char(ls.last_date, 'YYYY-MM-DD') as last_seen,
       (current_date - ls.last_date) as days_since,
       coalesce(array_agg(mi.name order by mi.name) filter (where mi.name is not null), '{}'::text[]) as ministries
     from members m
     join last_seen ls on ls.member_id = m.id
     left join member_ministries mm on mm.member_id = m.id
     left join ministries mi on mi.id = mm.ministry_id
     where m.organization_id = $1
       and ls.last_date < current_date - ($2)::int
       and m.membership_status = any($3)
       ${ministryClause}
     group by m.id, ls.last_date
     order by ls.last_date asc, m.full_name asc`,
    params
  );

  return c.json({
    generated_at: new Date().toISOString(),
    weeks,
    statuses,
    ministry_id: ministryId ?? null,
    rows: rows.map((r: any) => ({
      ...r,
      weeks_since: Math.floor(r.days_since / 7),
    })),
  });
});

// ---------------------------------------------------------------------------
// Member directory — the full filtered roster with household and ministries,
// no pagination. Feeds the CSV export and the printable directory.
// ---------------------------------------------------------------------------
reportRoutes.get("/member-directory", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const status = c.req.query("status");
  const ministryId = c.req.query("ministry_id");
  const householdId = c.req.query("household_id");
  const sort = c.req.query("sort") === "household" ? "household" : "name";

  const conditions: string[] = ["m.organization_id = $1"];
  const params: any[] = [orgId];

  if (status && (STATUSES as readonly string[]).includes(status)) {
    params.push(status);
    conditions.push(`m.membership_status = $${params.length}`);
  }
  if (householdId) {
    params.push(householdId);
    conditions.push(`m.household_id = $${params.length}`);
  }
  if (ministryId) {
    params.push(ministryId);
    conditions.push(
      `exists (select 1 from member_ministries mmf where mmf.member_id = m.id and mmf.ministry_id = $${params.length})`
    );
  }

  const orderBy =
    sort === "household"
      ? "h.name asc nulls last, m.full_name asc"
      : "m.full_name asc";

  const rows = await query(
    `select m.id, m.full_name, m.membership_status, m.gender, m.marital_status,
       m.phone, m.email, m.address,
       to_char(m.date_of_birth, 'YYYY-MM-DD') as date_of_birth,
       to_char(m.date_joined, 'YYYY-MM-DD') as date_joined,
       h.name as household_name,
       coalesce(array_agg(mi.name order by mi.name) filter (where mi.name is not null), '{}'::text[]) as ministries
     from members m
     left join households h on h.id = m.household_id
     left join member_ministries mm on mm.member_id = m.id
     left join ministries mi on mi.id = mm.ministry_id
     where ${conditions.join(" and ")}
     group by m.id, h.name
     order by ${orderBy}`,
    params
  );

  return c.json({
    generated_at: new Date().toISOString(),
    filters: { status: status ?? null, ministry_id: ministryId ?? null, household_id: householdId ?? null, sort },
    count: rows.length,
    rows,
  });
});

// ---------------------------------------------------------------------------
// Milestones for a month — birthdays, baptism anniversaries and membership
// anniversaries falling in the chosen calendar month. Same month/day matching
// idea as the dashboard's upcoming-birthdays widget, widened to a whole month.
// ---------------------------------------------------------------------------
reportRoutes.get("/milestones", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const monthParam = c.req.query("month");
  const month = monthParam && MONTH_RE.test(monthParam) ? monthParam : today().slice(0, 7);
  const year = parseInt(month.slice(0, 4), 10);
  const monthNum = parseInt(month.slice(5, 7), 10);

  // For each dated column: members whose month-of-date matches, with the day of
  // the month and how many years it is this year. The anniversary date is built
  // by adding the day-offset-within-its-year to Jan 1 of `year`, which sidesteps
  // make_date() blowing up on a Feb-29 date in a non-leap year.
  const milestoneQuery = (col: string) =>
    query<{ id: string; full_name: string; phone: string | null; email: string | null; day: number; years: number }>(
      `select m.id, m.full_name, m.phone, m.email,
         extract(day from m.${col})::int as day,
         extract(year from age(
           (make_date($3, 1, 1) + (m.${col} - date_trunc('year', m.${col})::date))::date,
           m.${col}
         ))::int as years
       from members m
       where m.organization_id = $1
         and m.${col} is not null
         and extract(month from m.${col}) = $2
       order by day asc, m.full_name asc`,
      [orgId, monthNum, year]
    );

  const [birthdays, baptisms, memberships] = await Promise.all([
    milestoneQuery("date_of_birth"),
    milestoneQuery("baptism_date"),
    milestoneQuery("date_joined"),
  ]);

  return c.json({
    generated_at: new Date().toISOString(),
    month,
    birthdays,
    // A "0-year" baptism/membership anniversary isn't a milestone worth listing.
    baptism_anniversaries: baptisms.filter((r) => r.years >= 1),
    membership_anniversaries: memberships.filter((r) => r.years >= 1),
  });
});

// ---------------------------------------------------------------------------
// Ministry roster — members grouped by ministry, with contact details. One
// ministry (ministry_id) or all of them; ministries with no members still list.
// ---------------------------------------------------------------------------
reportRoutes.get("/ministry-roster", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;
  const ministryId = c.req.query("ministry_id");

  const params: any[] = [orgId];
  let ministryClause = "";
  if (ministryId) {
    params.push(ministryId);
    ministryClause = `and mi.id = $${params.length}`;
  }

  const rows = await query<{
    ministry_id: string;
    ministry_name: string;
    member_id: string | null;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    membership_status: string | null;
  }>(
    `select mi.id as ministry_id, mi.name as ministry_name,
       m.id as member_id, m.full_name, m.phone, m.email, m.membership_status
     from ministries mi
     left join member_ministries mm on mm.ministry_id = mi.id
     left join members m on m.id = mm.member_id and m.organization_id = $1
     where mi.organization_id = $1
       ${ministryClause}
     order by mi.name asc, m.full_name asc`,
    params
  );

  const ministries: {
    ministry_id: string;
    ministry_name: string;
    member_count: number;
    members: { member_id: string; full_name: string; phone: string | null; email: string | null; membership_status: string }[];
  }[] = [];
  const byId = new Map<string, (typeof ministries)[number]>();

  for (const r of rows) {
    let entry = byId.get(r.ministry_id);
    if (!entry) {
      entry = { ministry_id: r.ministry_id, ministry_name: r.ministry_name, member_count: 0, members: [] };
      byId.set(r.ministry_id, entry);
      ministries.push(entry);
    }
    if (r.member_id) {
      entry.members.push({
        member_id: r.member_id,
        full_name: r.full_name!,
        phone: r.phone,
        email: r.email,
        membership_status: r.membership_status!,
      });
      entry.member_count += 1;
    }
  }

  return c.json({
    generated_at: new Date().toISOString(),
    ministry_id: ministryId ?? null,
    ministries,
  });
});
