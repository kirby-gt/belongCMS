import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Outlet, NavLink, Link, useLocation } from "react-router-dom";
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

const svg = (paths: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {paths}
  </svg>
);

const icons = {
  dashboard: svg(
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </>
  ),
  members: svg(
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  visitors: svg(
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </>
  ),
  attendance: svg(
    <>
      <rect x="3" y="4" width="18" height="18" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="m9 16 2 2 4-4" />
    </>
  ),
  reports: svg(
    <>
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="18" y1="20" x2="18" y2="10" />
    </>
  ),
  import: svg(
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </>
  ),
  guide: svg(
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  billing: svg(
    <>
      <rect x="1" y="4" width="22" height="16" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </>
  ),
  admin: svg(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />),
  church: svg(
    <>
      <path d="M12 2v6" />
      <path d="M9 5h6" />
      <path d="M12 8 4 13v9h16v-9z" />
      <path d="M9 22v-4a3 3 0 0 1 6 0v4" />
    </>
  ),
  menu: svg(
    <>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </>
  ),
};

type NavItem = { to: string; label: string; icon: ReactNode; end?: boolean };

const PRIMARY: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: icons.dashboard },
  { to: "/members", label: "Members", icon: icons.members, end: true },
  { to: "/visitors", label: "Visitors", icon: icons.visitors },
  { to: "/attendance", label: "Attendance", icon: icons.attendance },
  { to: "/reports", label: "Reports", icon: icons.reports },
];

const SECONDARY: NavItem[] = [
  { to: "/members/import", label: "Import", icon: icons.import },
  { to: "/guide", label: "Guide", icon: icons.guide },
  { to: "/billing", label: "Billing", icon: icons.billing },
];

export default function ProtectedRoute() {
  const { user, organization, logout } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  if (!user) return <Navigate to="/login" replace />;

  const showTrialBanner = organization?.plan_status === "trialing" && new Date(organization.trial_ends_at) > new Date();
  const renewal = renewalState(organization);
  const fmtDue = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const secondary = user.is_superadmin
    ? [...SECONDARY, { to: "/admin", label: "Admin", icon: icons.admin }]
    : SECONDARY;

  const renderLink = (item: NavItem) => (
    <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? "active" : "")}>
      {item.icon}
      <span>{item.label}</span>
    </NavLink>
  );

  return (
    <div className="app-shell">
      {navOpen && <div className="sidebar-scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}

      <aside className={navOpen ? "sidebar sidebar-open" : "sidebar"}>
        <div className="sidebar-head">
          <span className="brand">
            <img src="/logo.png" alt="" className="brand-mark" />
            Belong
          </span>
          {organization && (
            <span className="sidebar-org">
              {icons.church}
              <span>{organization.name}</span>
            </span>
          )}
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-group">{PRIMARY.map(renderLink)}</div>
          <div className="sidebar-group">{secondary.map(renderLink)}</div>
        </nav>

        <div className="sidebar-foot">
          <div className="user-chip">
            <span className="user-avatar">{initials(user.name)}</span>
            <span className="user-name">{user.name}</span>
          </div>
          <div className="sidebar-foot-actions">
            <ThemeToggle />
            <button onClick={logout} className="link-btn">
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <button
            type="button"
            className="nav-toggle"
            aria-label="Open menu"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            {icons.menu}
          </button>
          <span className="brand">
            <img src="/logo.png" alt="" className="brand-mark" />
            Belong
          </span>
          <div className="spacer" />
          <ThemeToggle />
        </header>

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
    </div>
  );
}
