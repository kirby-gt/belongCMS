import { Hono } from "hono";
import { query } from "../db.js";
import type { AuthUser } from "../auth.js";

export const dashboardRoutes = new Hono();

const STATUSES = ["Visitor", "New convert", "Member", "Inactive"] as const;
const MAX_MINISTRY_BARS = 8;
const GROWTH_MONTHS = 12;
const ATTENDANCE_SERVICES = 8;

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

dashboardRoutes.get("/summary", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;

  const [totalsRows, statusRows, ministryRows, growthRows, attendanceRows] = await Promise.all([
    query<{ members: string; households: string; ministries: string }>(
      `select
        (select count(*) from members where organization_id = $1) as members,
        (select count(*) from households where organization_id = $1) as households,
        (select count(*) from ministries where organization_id = $1) as ministries`,
      [orgId]
    ),
    query<{ membership_status: string; count: string }>(
      `select membership_status, count(*) from members where organization_id = $1 group by membership_status`,
      [orgId]
    ),
    query<{ name: string; count: string }>(
      `select mi.name, count(mm.member_id) as count
       from ministries mi
       left join member_ministries mm on mm.ministry_id = mi.id
       where mi.organization_id = $1
       group by mi.id, mi.name
       order by count(mm.member_id) desc, mi.name asc`,
      [orgId]
    ),
    query<{ month: string; count: string }>(
      `select to_char(date_trunc('month', date_joined), 'YYYY-MM') as month, count(*)
       from members
       where organization_id = $1
         and date_joined is not null
         and date_joined >= date_trunc('month', now()) - interval '${GROWTH_MONTHS - 1} months'
       group by 1`,
      [orgId]
    ),
    query<{ service_date: string; service_type: string; present: string; total: string }>(
      `select to_char(s.service_date, 'YYYY-MM-DD') as service_date, s.service_type,
        count(a.member_id) filter (where a.present) as present,
        count(a.member_id) as total
       from services s
       left join attendance a on a.service_id = s.id
       where s.organization_id = $1
       group by s.id
       order by s.service_date desc
       limit ${ATTENDANCE_SERVICES}`,
      [orgId]
    ),
  ]);

  const totals = {
    members: parseInt(totalsRows[0].members),
    households: parseInt(totalsRows[0].households),
    ministries: parseInt(totalsRows[0].ministries),
  };

  const statusCounts = new Map(statusRows.map((r) => [r.membership_status, parseInt(r.count)]));
  const members_by_status = STATUSES.map((status) => ({ status, count: statusCounts.get(status) ?? 0 }));

  const topMinistries = ministryRows.slice(0, MAX_MINISTRY_BARS).map((r) => ({ name: r.name, count: parseInt(r.count) }));
  const otherCount = ministryRows.slice(MAX_MINISTRY_BARS).reduce((sum, r) => sum + parseInt(r.count), 0);
  const members_by_ministry = otherCount > 0 ? [...topMinistries, { name: "Other", count: otherCount }] : topMinistries;

  const growthByMonth = new Map(growthRows.map((r) => [r.month, parseInt(r.count)]));
  const now = new Date();
  const membership_growth = Array.from({ length: GROWTH_MONTHS }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (GROWTH_MONTHS - 1 - i), 1);
    const key = monthKey(d);
    return { month: key, count: growthByMonth.get(key) ?? 0 };
  });

  const attendance_trend = attendanceRows
    .map((r) => ({
      service_date: r.service_date,
      service_type: r.service_type,
      present: parseInt(r.present),
      total: parseInt(r.total),
    }))
    .reverse();

  return c.json({ totals, members_by_status, members_by_ministry, membership_growth, attendance_trend });
});
