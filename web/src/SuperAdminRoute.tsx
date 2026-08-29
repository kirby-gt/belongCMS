import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

// Gate for the platform-operator console. Non-super-admins are bounced to their
// dashboard; the API enforces the same check independently.
export default function SuperAdminRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_superadmin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
