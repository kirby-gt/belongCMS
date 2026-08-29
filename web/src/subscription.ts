// Client-side mirror of the API's subscription gate (api/src/auth.ts —
// orgHasAccess / RENEWAL_* constants). Keep the two in sync.

export const RENEWAL_GRACE_DAYS = 5;
export const RENEWAL_REMINDER_DAYS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

interface OrgLike {
  plan_status: string;
  trial_ends_at: string;
  current_period_end: string | null;
}

export function hasAccess(org: OrgLike | null | undefined, now = Date.now()): boolean {
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

export type RenewalState =
  | { phase: "none" }
  | { phase: "upcoming"; dueDate: Date; daysUntilDue: number }
  | { phase: "grace"; dueDate: Date; daysLeft: number; daysOverdue: number };

// What renewal reminder (if any) to show for a paid org.
export function renewalState(org: OrgLike | null | undefined, now = Date.now()): RenewalState {
  if (!org || org.current_period_end == null) return { phase: "none" };
  if (org.plan_status !== "active" && org.plan_status !== "pending_review") return { phase: "none" };

  const due = new Date(org.current_period_end).getTime();
  const graceEnd = due + RENEWAL_GRACE_DAYS * DAY_MS;
  if (now > graceEnd) return { phase: "none" }; // access already lost — SubscriptionGate handles it

  if (now >= due) {
    return {
      phase: "grace",
      dueDate: new Date(due),
      daysLeft: Math.max(0, Math.ceil((graceEnd - now) / DAY_MS)),
      daysOverdue: Math.max(0, Math.floor((now - due) / DAY_MS)),
    };
  }

  const daysUntilDue = Math.ceil((due - now) / DAY_MS);
  if (daysUntilDue <= RENEWAL_REMINDER_DAYS) {
    return { phase: "upcoming", dueDate: new Date(due), daysUntilDue };
  }
  return { phase: "none" };
}
