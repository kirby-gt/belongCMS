import { Outlet, Link } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function SubscriptionGate() {
  const { organization, orgLoading } = useAuth();

  if (orgLoading || !organization) return null;

  const trialActive = organization.plan_status === "trialing" && new Date(organization.trial_ends_at) > new Date();
  const isActive = organization.plan_status === "active" || trialActive;

  if (isActive) return <Outlet />;

  const statusText =
    organization.plan_status === "pending_review"
      ? "We're verifying your payment. This usually only takes a short while — check back soon."
      : "Your free trial has ended. Subscribe to keep using the app.";

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
