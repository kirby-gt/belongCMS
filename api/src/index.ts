import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth.js";
import { publicRoutes } from "./routes/public.js";
import { memberRoutes } from "./routes/members.js";
import { householdRoutes } from "./routes/households.js";
import { ministryRoutes } from "./routes/ministries.js";
import { attendanceRoutes } from "./routes/attendance.js";
import { organizationRoutes } from "./routes/organizations.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { reportRoutes } from "./routes/reports.js";
import { visitorCheckinRoutes } from "./routes/visitor-checkins.js";
import { adminRoutes } from "./routes/admin.js";
import { requireAuth, requireActiveOrg, requireSuperAdmin } from "./auth.js";

const app = new Hono();

app.use("*", cors());
app.use("/uploads/*", serveStatic({ root: "./" }));

app.get("/health", (c) => c.json({ ok: true }));

app.route("/auth", authRoutes);
// Unauthenticated visitor self-check-in (QR code intake).
app.route("/public", publicRoutes);

// Requires a logged-in user, but not an active subscription (so a trial-expired
// or pending-review org can still view/manage its own billing status)
app.use("/organizations/*", requireAuth);
app.route("/organizations", organizationRoutes);

// Platform-operator tier: cross-tenant, no active-subscription requirement.
app.use("/admin/*", requireAuth, requireSuperAdmin);
app.route("/admin", adminRoutes);

// Everything below requires a logged-in user with an active trial or subscription
app.use("/members/*", requireAuth, requireActiveOrg);
app.use("/households/*", requireAuth, requireActiveOrg);
app.use("/ministries/*", requireAuth, requireActiveOrg);
app.use("/attendance/*", requireAuth, requireActiveOrg);
app.use("/dashboard/*", requireAuth, requireActiveOrg);
app.use("/reports/*", requireAuth, requireActiveOrg);
app.use("/visitor-checkins/*", requireAuth, requireActiveOrg);

app.route("/members", memberRoutes);
app.route("/households", householdRoutes);
app.route("/ministries", ministryRoutes);
app.route("/attendance", attendanceRoutes);
app.route("/dashboard", dashboardRoutes);
app.route("/reports", reportRoutes);
app.route("/visitor-checkins", visitorCheckinRoutes);

const port = Number(process.env.PORT) || 3001;
console.log(`API listening on port ${port}`);
serve({ fetch: app.fetch, port });
