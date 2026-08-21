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
      setError("No reset token provided");
      return;
    }
    
    setError("");
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      navigate("/login", { state: { message: "Password has been successfully reset. Please log in." } });
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Reset Password</h1>
        {error && <div className="error">{error}</div>}
        
        <label>New Password</label>
        <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Resetting..." : "Reset password"}
        </button>
        
        <p className="auth-link">
          <Link to="/login">Back to Login</Link>
        </p>
      </form>
    </div>
  );
}
