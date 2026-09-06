import { useState, type FormEvent } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const stateMessage = location.state?.message;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <img src="/logo.png" alt="Belong" className="login-logo" />
        <h1>Belong</h1>
        <p className="subtitle">Sign in to continue</p>
        {stateMessage && <p className="form-success">{stateMessage}</p>}
        {error && <p className="error">{error}</p>}
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <div style={{ textAlign: "right", marginBottom: "1rem", fontSize: "0.9rem" }}>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <button type="submit" className="btn-primary">
          Sign in
        </button>
        <p className="subtitle" style={{ margin: "16px 0 0", textAlign: "center" }}>
          New here? <Link to="/signup">Start a free trial</Link>
        </p>
      </form>
    </div>
  );
}
