import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api } from "./api";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  organization_id: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan_status: "trialing" | "active" | "pending_review" | "canceled";
  trial_ends_at: string;
  payment_reference: string | null;
  payment_submitted_at: string | null;
  subscribed_at: string | null;
}

interface AuthContextValue {
  user: User | null;
  organization: Organization | null;
  orgLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: { organization_name: string; admin_name: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
  refreshOrganization: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);

  const refreshOrganization = useCallback(async () => {
    if (!localStorage.getItem("token")) {
      setOrganization(null);
      setOrgLoading(false);
      return;
    }
    setOrgLoading(true);
    try {
      const org = await api.getOrganization();
      setOrganization(org);
    } finally {
      setOrgLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshOrganization();
  }, [user, refreshOrganization]);

  async function login(email: string, password: string) {
    const res = await api.login(email, password);
    localStorage.setItem("token", res.token);
    localStorage.setItem("user", JSON.stringify(res.user));
    setUser(res.user);
  }

  async function signup(data: { organization_name: string; admin_name: string; email: string; password: string }) {
    const res = await api.signup(data);
    localStorage.setItem("token", res.token);
    localStorage.setItem("user", JSON.stringify(res.user));
    setUser(res.user);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setOrganization(null);
  }

  return (
    <AuthContext.Provider value={{ user, organization, orgLoading, login, signup, logout, refreshOrganization }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
