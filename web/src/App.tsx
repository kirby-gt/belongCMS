import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import { ThemeProvider } from "./ThemeContext";
import ProtectedRoute from "./ProtectedRoute";
import SubscriptionGate from "./SubscriptionGate";
import SuperAdminRoute from "./SuperAdminRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Billing from "./pages/Billing";
import Guide from "./pages/Guide";
import Dashboard from "./pages/Dashboard";
import Attendance from "./pages/Attendance";
import MembersList from "./pages/MembersList";
import MemberForm from "./pages/MemberForm";
import ImportMembers from "./pages/ImportMembers";
import Visitors from "./pages/Visitors";
import VisitorCheckin from "./pages/VisitorCheckin";
import Admin from "./pages/Admin";
import Reports from "./pages/Reports";
import ReportAttendanceSummary from "./pages/ReportAttendanceSummary";
import ReportAbsentees from "./pages/ReportAbsentees";
import ReportDirectory from "./pages/ReportDirectory";
import ReportMilestones from "./pages/ReportMilestones";
import ReportMinistryRoster from "./pages/ReportMinistryRoster";

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
            <Route path="/welcome/:token" element={<VisitorCheckin />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/billing" element={<Billing />} />
              <Route path="/guide" element={<Guide />} />
              <Route element={<SuperAdminRoute />}>
                <Route path="/admin" element={<Admin />} />
              </Route>
              <Route element={<SubscriptionGate />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/reports/attendance" element={<ReportAttendanceSummary />} />
                <Route path="/reports/absentees" element={<ReportAbsentees />} />
                <Route path="/reports/directory" element={<ReportDirectory />} />
                <Route path="/reports/milestones" element={<ReportMilestones />} />
                <Route path="/reports/ministries" element={<ReportMinistryRoster />} />
                <Route path="/members" element={<MembersList />} />
                <Route path="/members/new" element={<MemberForm />} />
                <Route path="/members/import" element={<ImportMembers />} />
                <Route path="/members/:id" element={<MemberForm />} />
                <Route path="/visitors" element={<Visitors />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
