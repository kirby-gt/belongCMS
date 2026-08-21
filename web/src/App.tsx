import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import { ThemeProvider } from "./ThemeContext";
import ProtectedRoute from "./ProtectedRoute";
import SubscriptionGate from "./SubscriptionGate";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Billing from "./pages/Billing";
import Dashboard from "./pages/Dashboard";
import MembersList from "./pages/MembersList";
import MemberForm from "./pages/MemberForm";
import ImportMembers from "./pages/ImportMembers";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/billing" element={<Billing />} />
              <Route element={<SubscriptionGate />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/members" element={<MembersList />} />
                <Route path="/members/new" element={<MemberForm />} />
                <Route path="/members/import" element={<ImportMembers />} />
                <Route path="/members/:id" element={<MemberForm />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
