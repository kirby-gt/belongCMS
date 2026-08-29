import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setMessage("If that email is in our system, we've sent a reset link. Check your inbox.");
    } catch (err: any) {
      setError(err.message || "Failed to request password reset");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <img src="/logo.png" alt="Belong" className="login-logo" />
        <h1>Forgot password</h1>
        <p className="subtitle">Enter your email and we'll send you a link to reset it.</p>
        {error && <p className="error">{error}</p>}
        {message && <p style={{ color: "green", marginBottom: "1rem" }}>{message}</p>}
        <label>Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </button>
        <p className="subtitle" style={{ margin: "16px 0 0", textAlign: "center" }}>
          Remember your password? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
