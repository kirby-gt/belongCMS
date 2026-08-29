import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";

// Public, no-login page a visitor reaches by scanning a church's QR code
// (/welcome/:token). The entry time is recorded server-side on submit.
export default function VisitorCheckin() {
  const { token = "" } = useParams();
  const [orgName, setOrgName] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    address: "",
    first_time: false,
    prayer_request: "",
    company: "", // honeypot — must stay empty
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getCheckinInfo(token)
      .then((res) => setOrgName(res.organization_name))
      .catch((err) => setLoadError(err.message || "This check-in link is not active."))
      .finally(() => setLoading(false));
  }, [token]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.submitCheckin(token, {
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        first_time: form.first_time,
        prayer_request: form.prayer_request.trim() || undefined,
        ...(form.company ? { company: form.company } : {}),
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card">Loading…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="login-page">
        <div className="login-card">
          <img src="/logo.png" alt="Belong" className="login-logo" />
          <h1>Check-in unavailable</h1>
          <p className="subtitle">{loadError}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    const firstName = form.full_name.trim().split(/\s+/)[0];
    return (
      <div className="login-page">
        <div className="login-card">
          <img src="/logo.png" alt="Belong" className="login-logo" />
          <h1>You're checked in 🎉</h1>
          <p className="subtitle">
            Thanks{firstName ? `, ${firstName}` : ""}! {orgName} is glad you came — someone will reach out to
            welcome you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <img src="/logo.png" alt="Belong" className="login-logo" />
        <h1>Welcome to {orgName}</h1>
        <p className="subtitle">Tell us a little about yourself so we can say hello.</p>
        {error && <p className="error">{error}</p>}

        <label>Your name *</label>
        <input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} required maxLength={120} />

        <label>Phone</label>
        <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={40} />

        <label>Email</label>
        <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} maxLength={200} />

        <label>Address</label>
        <input value={form.address} onChange={(e) => set("address", e.target.value)} maxLength={300} />

        <label className="checkin-check">
          <input
            type="checkbox"
            checked={form.first_time}
            onChange={(e) => set("first_time", e.target.checked)}
          />
          This is my first time visiting
        </label>

        <label>Anything we can pray with you about?</label>
        <textarea
          value={form.prayer_request}
          onChange={(e) => set("prayer_request", e.target.value)}
          rows={3}
          maxLength={2000}
        />

        <input
          type="text"
          className="hp-field"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={form.company}
          onChange={(e) => set("company", e.target.value)}
        />

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Submitting…" : "Check in"}
        </button>
      </form>
    </div>
  );
}
