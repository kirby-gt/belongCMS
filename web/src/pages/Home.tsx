import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import ThemeToggle from "../components/ThemeToggle";

const FEATURES = [
  {
    title: "Member records",
    description: "Bio data, membership status, date joined, baptism date, occupation, and emergency contacts.",
  },
  {
    title: "Households",
    description: "Group members into families automatically as you enter data — no need to pre-create households.",
  },
  {
    title: "Ministries",
    description: "Assign members to choir, ushering, youth, or any department you run, and filter by it.",
  },
  {
    title: "Attendance",
    description:
      "Check members in for Sunday and special services like Mother's Day, with monthly averages and visitor counts per event.",
  },
  {
    title: "CSV import",
    description: "Bulk-load members from a spreadsheet as you digitize paper records. Bad rows are reported individually.",
  },
  {
    title: "Search & filter",
    description: "Find members by name, status, or ministry, with pagination built in.",
  },
];

export default function Home() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="home-page">
      <nav className="home-nav">
        <span className="brand">
          <img src="/logo.png" alt="" className="brand-mark" />
          Belong
        </span>
        <div className="spacer" />
        <ThemeToggle />
        <Link to="/login" className="link-btn">
          Sign in
        </Link>
        <Link to="/signup" className="btn-primary">
          Start free trial
        </Link>
      </nav>

      <header className="home-hero">
        <h1>Keep your whole church on one register.</h1>
        <p className="home-hero-sub">
          Belong holds your members' bio data, membership status, households, ministries, and attendance in one
          place — built for congregations of 100 to 5,000.
        </p>
        <div className="home-hero-actions">
          <Link to="/signup" className="btn-primary">
            Start your free trial
          </Link>
          <Link to="/login" className="link-btn">
            Already have an account? Sign in
          </Link>
        </div>
        <p className="home-hero-note">14 days free, no card required.</p>
      </header>

      <section className="home-features">
        {FEATURES.map((f) => (
          <div className="home-feature-card" key={f.title}>
            <h2>{f.title}</h2>
            <p>{f.description}</p>
          </div>
        ))}
      </section>

      <footer className="home-footer">
        <span>© {new Date().getFullYear()} Belong</span>
        <Link to="/login">Sign in</Link>
        <Link to="/signup">Start a free trial</Link>
        <span className="home-footer-credit">Developed by CyberWorks · 2026</span>
      </footer>
    </div>
  );
}
