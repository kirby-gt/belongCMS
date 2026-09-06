import { Navigate, Outlet, NavLink, Link } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { renewalState } from "./subscription";
import ThemeToggle from "./components/ThemeToggle";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function daysLeft(trialEndsAt: string) {
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export default function ProtectedRoute() {
  const { user, organization, logout } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  const showTrialBanner = organization?.plan_status === "trialing" && new Date(organization.trial_ends_at) > new Date();
  const renewal = renewalState(organization);
  const fmtDue = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="app-shell">
      <nav className="topnav">
        <span className="brand">
          <img src="/logo.png" alt="" className="brand-mark" />
          Belong
        </span>
        <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
          Dashboard
        </NavLink>
        <NavLink to="/members" end className={({ isActive }) => (isActive ? "active" : "")}>
          Members
        </NavLink>
        <NavLink to="/visitors" className={({ isActive }) => (isActive ? "active" : "")}>
          Visitors
        </NavLink>
        <NavLink to="/attendance" className={({ isActive }) => (isActive ? "active" : "")}>
          Attendance
        </NavLink>
        <NavLink to="/reports" className={({ isActive }) => (isActive ? "active" : "")}>
          Reports
        </NavLink>
        <NavLink to="/members/import" className={({ isActive }) => (isActive ? "active" : "")}>
          Import
        </NavLink>
        <NavLink to="/guide" className={({ isActive }) => (isActive ? "active" : "")}>
          Guide
        </NavLink>
        <NavLink to="/billing" className={({ isActive }) => (isActive ? "active" : "")}>
          Billing
        </NavLink>
        {user.is_superadmin && (
          <NavLink to="/admin" className={({ isActive }) => (isActive ? "active" : "")}>
            Admin
          </NavLink>
        )}
        <div className="spacer" />
        <ThemeToggle />
        <div className="user-chip">
          <span className="user-avatar">{initials(user.name)}</span>
          <span className="user-name">{user.name}</span>
        </div>
        <button onClick={logout} className="link-btn">
          Sign out
        </button>
      </nav>
      {showTrialBanner && organization && (
        <div className="trial-banner">
          {daysLeft(organization.trial_ends_at)} day{daysLeft(organization.trial_ends_at) === 1 ? "" : "s"} left in your
          free trial. <Link to="/billing">Subscribe now</Link>
        </div>
      )}
      {renewal.phase === "upcoming" && (
        <div className="trial-banner">
          Your subscription is due {renewal.daysUntilDue === 0 ? "today" : `in ${renewal.daysUntilDue} day${renewal.daysUntilDue === 1 ? "" : "s"}`} ({fmtDue(renewal.dueDate)}).{" "}
          <Link to="/billing">Pay & submit your reference</Link>
        </div>
      )}
      {renewal.phase === "grace" && (
        <div className="trial-banner trial-banner-urgent">
          Your subscription was due {renewal.daysOverdue === 0 ? "today" : `${renewal.daysOverdue} day${renewal.daysOverdue === 1 ? "" : "s"} ago`}. Access ends in {renewal.daysLeft} day{renewal.daysLeft === 1 ? "" : "s"} unless payment is verified.{" "}
          <Link to="/billing">Pay now</Link>
        </div>
      )}
      <main>
        <Outlet />
      </main>
    </div>
  );
}
