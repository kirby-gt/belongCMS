import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("No reset token provided. Request a new reset link.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      navigate("/login", { state: { message: "Password reset. Please sign in with your new password." } });
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <img src="/logo.png" alt="Belong" className="login-logo" />
        <h1>Reset password</h1>
        <p className="subtitle">Choose a new password for your account.</p>
        {error && <p className="error">{error}</p>}
        {!token && (
          <p className="subtitle">
            This page needs a valid link from your reset email. <Link to="/forgot-password">Request a new one</Link>.
          </p>
        )}
        <label>New password</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
        <button type="submit" className="btn-primary" disabled={loading || !token}>
          {loading ? "Resetting…" : "Reset password"}
        </button>
        <p className="subtitle" style={{ margin: "16px 0 0", textAlign: "center" }}>
          <Link to="/login">Back to sign in</Link>
        </p>
      </form>
    </div>
  );
}
