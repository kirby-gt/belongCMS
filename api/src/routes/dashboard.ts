import { Hono } from "hono";
import { query } from "../db.js";
import type { AuthUser } from "../auth.js";

export const dashboardRoutes = new Hono();

const STATUSES = ["Visitor", "New convert", "Member", "Inactive"] as const;
const MAX_MINISTRY_BARS = 8;
const GROWTH_MONTHS = 12;
const ATTENDANCE_SERVICES = 8;
const BIRTHDAY_WINDOW_DAYS = 7;

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

dashboardRoutes.get("/summary", async (c) => {
  const orgId = (c.get("user") as AuthUser).organization_id;

  const [totalsRows, statusRows, ministryRows, growthRows, attendanceRows, monthAttendanceRows, birthdayRows] = await Promise.all([
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
    // Current calendar month: average attendance (over services with attendance
    // recorded) and total visitors (manual headcount when entered, else the QR
    // self-check-in count for that day). Mirrors /attendance/monthly-summary.
    query<{
      attended_service_count: string;
      total_present: string;
      sunday_service_count: string;
      sunday_present: string;
      total_visitors: string;
    }>(
      `select
         count(*) filter (where present_count > 0)::int as attended_service_count,
         coalesce(sum(present_count) filter (where present_count > 0), 0)::int as total_present,
         count(*) filter (where present_count > 0 and lower(service_type) = 'sunday')::int as sunday_service_count,
         coalesce(sum(present_count) filter (where present_count > 0 and lower(service_type) = 'sunday'), 0)::int as sunday_present,
         coalesce(sum(coalesce(visitor_count, checkin_count, 0)), 0)::int as total_visitors
       from (
         select s.id, s.service_type, s.visitor_count,
           (select count(*) from attendance a where a.service_id = s.id and a.present)::int as present_count,
           (select count(*) from visitor_checkins vc
             where vc.organization_id = s.organization_id
               and vc.checked_in_at::date = s.service_date)::int as checkin_count
         from services s
         where s.organization_id = $1
           and s.service_date >= date_trunc('month', now())
           and s.service_date < date_trunc('month', now()) + interval '1 month'
       ) sub`,
      [orgId]
    ),
    // Members whose birthday lands within the next BIRTHDAY_WINDOW_DAYS days,
    // today inclusive. Joining against a small day-offset series matches on
    // month/day and wraps across year-end for free; `days_until` is that offset
    // so the client can label "Today"/"Tomorrow" without having to know the
    // server's date. (A Feb-29 birthday only shows in a window spanning Feb 29.)
    query<{
      id: string;
      full_name: string;
      date_of_birth: string;
      next_birthday: string;
      days_until: number;
      turning_age: number;
    }>(
      `select m.id, m.full_name,
         to_char(m.date_of_birth, 'YYYY-MM-DD') as date_of_birth,
         to_char(current_date + g.i, 'YYYY-MM-DD') as next_birthday,
         g.i as days_until,
         extract(year from age(current_date + g.i, m.date_of_birth))::int as turning_age
       from members m
       join generate_series(0, ${BIRTHDAY_WINDOW_DAYS - 1}) g(i)
         on extract(month from current_date + g.i) = extract(month from m.date_of_birth)
        and extract(day from current_date + g.i) = extract(day from m.date_of_birth)
       where m.organization_id = $1 and m.date_of_birth is not null
       order by g.i asc, m.full_name asc`,
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

  const m = monthAttendanceRows[0];
  const attendedCount = parseInt(m.attended_service_count);
  const sundayCount = parseInt(m.sunday_service_count);
  const attendance_this_month = {
    month: monthKey(now),
    attended_service_count: attendedCount,
    average_attendance: attendedCount ? Math.round(parseInt(m.total_present) / attendedCount) : null,
    sunday_average_attendance: sundayCount ? Math.round(parseInt(m.sunday_present) / sundayCount) : null,
    total_visitors: parseInt(m.total_visitors),
  };

  const upcoming_birthdays = birthdayRows.map((r) => ({
    id: r.id,
    full_name: r.full_name,
    date_of_birth: r.date_of_birth,
    next_birthday: r.next_birthday,
    days_until: Number(r.days_until),
    turning_age: Number(r.turning_age),
  }));

  return c.json({
    totals,
    members_by_status,
    members_by_ministry,
    membership_growth,
    attendance_trend,
    attendance_this_month,
    upcoming_birthdays,
  });
});
