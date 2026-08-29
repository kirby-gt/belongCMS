import { Outlet, Link } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { hasAccess } from "./subscription";

export default function SubscriptionGate() {
  const { organization, orgLoading } = useAuth();

  if (orgLoading || !organization) return null;

  if (hasAccess(organization)) return <Outlet />;

  let statusText: string;
  if (organization.plan_status === "pending_review") {
    statusText = "We're verifying your payment. This usually only takes a short while — check back soon.";
  } else if (organization.current_period_end) {
    statusText =
      "Your subscription has lapsed. Submit your latest payment reference so we can verify it and restore access.";
  } else {
    statusText = "Your free trial has ended. Subscribe to keep using the app.";
  }

  return (
    <div className="gate-page">
      <div className="gate-card">
        <img src="/logo.png" alt="Belong" className="login-logo" />
        <h1>Subscription required</h1>
        <p className="subtitle">{statusText}</p>
        <Link to="/billing" className="btn-primary">
          Go to billing
        </Link>
      </div>
    </div>
  );
}
