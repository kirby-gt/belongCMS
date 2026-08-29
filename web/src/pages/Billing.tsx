import { useState, type FormEvent } from "react";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import { renewalState } from "../subscription";

function daysLeft(trialEndsAt: string) {
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

const statusLabel: Record<string, string> = {
  trialing: "Trial",
  active: "Active",
  pending_review: "Pending review",
  canceled: "Canceled",
};

export default function Billing() {
  const { organization, refreshOrganization } = useAuth();
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!organization) return null;

  const trialActive = organization.plan_status === "trialing" && new Date(organization.trial_ends_at) > new Date();
  const renewal = renewalState(organization);
  // Open the payment form whenever they're not fully paid-and-current: not active,
  // or active but within the 5-day-before / 5-day-grace renewal window.
  const showPaymentForm = organization.plan_status !== "active" || renewal.phase !== "none";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.submitPayment(reference.trim());
      await refreshOrganization();
      setReference("");
    } catch (err: any) {
      setError(err.message || "Failed to submit payment reference");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Billing</h1>
        <span className={`badge badge-${organization.plan_status.replace("_", "-")}`}>
          {statusLabel[organization.plan_status] || organization.plan_status}
        </span>
      </div>

      <div className="member-form">
        {organization.plan_status === "active" && (
          <p>
            Your subscription is active
            {organization.subscribed_at ? ` since ${new Date(organization.subscribed_at).toLocaleDateString()}` : ""}.
            {organization.current_period_end && (
              <>
                {" "}
                {renewal.phase === "grace"
                  ? `Payment was due on ${fmtDate(organization.current_period_end)} — you have ${renewal.daysLeft} day${renewal.daysLeft === 1 ? "" : "s"} of access left.`
                  : `Next payment due ${fmtDate(organization.current_period_end)}.`}
              </>
            )}
          </p>
        )}

        {organization.plan_status === "pending_review" && renewal.phase !== "none" && (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            You still have access while we verify your payment.
          </p>
        )}

        {organization.plan_status === "trialing" && (
          <p>
            {trialActive
              ? `You have ${daysLeft(organization.trial_ends_at)} day${daysLeft(organization.trial_ends_at) === 1 ? "" : "s"} left in your free trial.`
              : "Your free trial has ended."}{" "}
            Subscribe below to keep using the app without interruption.
          </p>
        )}

        {organization.plan_status === "pending_review" && (
          <p>
            We received your payment reference (<strong>{organization.payment_reference}</strong>) on{" "}
            {organization.payment_submitted_at ? new Date(organization.payment_submitted_at).toLocaleDateString() : "—"}.
            We're verifying it and will activate your account shortly.
          </p>
        )}

        {showPaymentForm && (
          <>
            <h2>{organization.plan_status === "active" ? "Renew with MMG" : "Pay with MMG"}</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 16 }}>
              Send your subscription payment via MMG mobile money to <strong>+592-XXX-XXXX</strong> (merchant code{" "}
              <strong>CHURCHMS</strong>), then enter the transaction reference below so we can verify it.
            </p>

            {error && <p className="error">{error}</p>}

            <form onSubmit={handleSubmit}>
              <label>MMG transaction reference</label>
              <input value={reference} onChange={(e) => setReference(e.target.value)} required />
              <button type="submit" className="btn-primary" disabled={submitting || !reference.trim()}>
                {submitting ? "Submitting…" : "Submit payment reference"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
