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
      setMessage("If that email is in our system, we have sent a reset link.");
    } catch (err: any) {
      setError(err.message || "Failed to request password reset");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Forgot Password</h1>
        {error && <div className="error">{error}</div>}
        {message && <div style={{ color: "green", marginBottom: "1rem" }}>{message}</div>}
        
        <label>Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </button>
        
        <p className="auth-link">
          Remember your password? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
