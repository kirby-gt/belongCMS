import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../api";
import StatCard from "../components/charts/StatCard";

interface ServiceFigures {
  id: string;
  service_date: string;
  service_type: string;
  name: string | null;
  visitor_count: number | null;
  present: number;
  visitors_present: number;
  visitor_checkins: number;
}

interface MonthlySummary {
  month: string;
  service_count: number;
  attended_service_count: number;
  total_present: number;
  average_attendance: number | null;
  sunday_service_count: number;
  sunday_average_attendance: number | null;
  total_visitors: number;
  visitor_breakdown: { manual: number; checkins: number; visitor_status_present: number };
  services: ServiceFigures[];
}

interface RosterRow {
  member_id: string;
  full_name: string;
  membership_status: string;
  present: boolean;
}

const SERVICE_TYPES = ["Sunday", "Midweek", "Special"];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentMonthISO() {
  return todayISO().slice(0, 7);
}

function formatServiceDate(date: string) {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function serviceLabel(s: { name: string | null; service_type: string }) {
  return s.name?.trim() || s.service_type;
}

export default function Attendance() {
  const [month, setMonth] = useState(currentMonthISO());
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Add-service form
  const [newDate, setNewDate] = useState(todayISO());
  const [newType, setNewType] = useState("Sunday");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadSummary = useCallback(() => {
    api
      .getMonthlyAttendance(month)
      .then(setSummary)
      .catch((e) => setError(e.message || "Failed to load attendance"));
  }, [month]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const svc = await api.createOrGetService(newDate, newType, newName);
      setNewName("");
      if (newDate.slice(0, 7) !== month) setMonth(newDate.slice(0, 7));
      else loadSummary();
      setSelectedId(svc.id);
    } catch (e: any) {
      setError(e.message || "Failed to create service");
    } finally {
      setCreating(false);
    }
  }

  if (selectedId) {
    return (
      <ServiceDetail
        serviceId={selectedId}
        onBack={() => {
          setSelectedId(null);
          loadSummary();
        }}
      />
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Attendance</h1>
        <input
          type="month"
          className="month-picker"
          value={month}
          onChange={(e) => setMonth(e.target.value || currentMonthISO())}
        />
      </div>

      {error && <p className="error">{error}</p>}

      <div className="stat-grid">
        <StatCard label="Services held" value={summary ? summary.service_count : "—"} />
        <StatCard label="Avg. attendance (month)" value={summary?.average_attendance ?? "—"} />
        <StatCard label="Avg. Sunday attendance" value={summary?.sunday_average_attendance ?? "—"} />
        <StatCard label="Visitors (month)" value={summary ? summary.total_visitors : "—"} />
      </div>

      <form className="add-service-bar" onSubmit={handleCreate}>
        <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required />
        <select value={newType} onChange={(e) => setNewType(e.target.value)}>
          {SERVICE_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Event name (optional) — e.g. Mother's Day"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={creating}>
          {creating ? "Adding…" : "Add / open service"}
        </button>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Service</th>
              <th>Present</th>
              <th>Visitors</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {summary && summary.services.length === 0 && (
              <tr>
                <td colSpan={5} className="table-empty">
                  No services this month yet. Add one above.
                </td>
              </tr>
            )}
            {summary?.services.map((s) => (
              <tr key={s.id} className="clickable-row" onClick={() => setSelectedId(s.id)}>
                <td>{formatServiceDate(s.service_date)}</td>
                <td>
                  {serviceLabel(s)}
                  {s.name?.trim() && <span className="badge badge-inactive service-type-tag">{s.service_type}</span>}
                </td>
                <td>{s.present}</td>
                <td>
                  <strong>{s.visitor_count ?? s.visitor_checkins}</strong>
                  <span className="visitor-mini">
                    manual {s.visitor_count ?? "—"} · QR {s.visitor_checkins} · visitor-status {s.visitors_present}
                  </span>
                </td>
                <td className="row-chevron">›</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {summary && (
        <p className="attendance-note">
          Average attendance is taken over the {summary.attended_service_count} service
          {summary.attended_service_count === 1 ? "" : "s"} that had attendance recorded. Visitors per service uses the
          manual headcount when entered, otherwise the QR self-check-in count for that day.
        </p>
      )}
    </div>
  );
}

function ServiceDetail({ serviceId, onBack }: { serviceId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<ServiceFigures | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const [nameInput, setNameInput] = useState("");
  const [typeInput, setTypeInput] = useState("Sunday");
  const [visitorInput, setVisitorInput] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const loadDetail = useCallback(() => {
    api
      .getServiceSummary(serviceId)
      .then((d: ServiceFigures) => {
        setDetail(d);
        setNameInput(d.name ?? "");
        setTypeInput(d.service_type);
        setVisitorInput(d.visitor_count == null ? "" : String(d.visitor_count));
      })
      .catch((e) => setError(e.message || "Failed to load service"));
  }, [serviceId]);

  useEffect(() => {
    loadDetail();
    api
      .getServiceAttendance(serviceId)
      .then(setRoster)
      .catch((e) => setError(e.message || "Failed to load roster"));
  }, [serviceId, loadDetail]);

  const presentCount = roster.filter((r) => r.present).length;
  const visitorsPresent = roster.filter((r) => r.present && r.membership_status === "Visitor").length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? roster.filter((r) => r.full_name.toLowerCase().includes(q)) : roster;
  }, [roster, search]);

  async function toggle(memberId: string, present: boolean) {
    setError("");
    setRoster((rows) => rows.map((r) => (r.member_id === memberId ? { ...r, present } : r)));
    try {
      await api.checkIn(serviceId, memberId, present);
    } catch (e: any) {
      setRoster((rows) => rows.map((r) => (r.member_id === memberId ? { ...r, present: !present } : r)));
      setError(e.message || "Failed to save check-in");
    }
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSavingSettings(true);
    try {
      const trimmed = visitorInput.trim();
      await api.updateService(serviceId, {
        name: nameInput.trim() || null,
        service_type: typeInput,
        visitor_count: trimmed === "" ? null : Math.max(0, Math.floor(Number(trimmed) || 0)),
      });
      loadDetail();
    } catch (e: any) {
      setError(e.message || "Failed to save");
    } finally {
      setSavingSettings(false);
    }
  }

  async function removeService() {
    if (!confirm("Delete this service and its attendance records? This cannot be undone.")) return;
    try {
      await api.deleteService(serviceId);
      onBack();
    } catch (e: any) {
      setError(e.message || "Failed to delete service");
    }
  }

  return (
    <div className="page">
      <button type="button" className="link-btn back-link" onClick={onBack}>
        ‹ All services
      </button>

      <div className="page-header">
        <h1>{detail ? formatServiceDate(detail.service_date) : "Service"}</h1>
        <button type="button" className="link-btn danger-link" onClick={removeService}>
          Delete service
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <form className="service-settings" onSubmit={saveSettings}>
        <label>
          Event name
          <input
            type="text"
            placeholder="e.g. Mother's Day"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
          />
        </label>
        <label>
          Type
          <select value={typeInput} onChange={(e) => setTypeInput(e.target.value)}>
            {SERVICE_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Visitor headcount
          <input
            type="number"
            min={0}
            placeholder="manual count"
            value={visitorInput}
            onChange={(e) => setVisitorInput(e.target.value)}
          />
        </label>
        <button type="submit" className="btn-primary" disabled={savingSettings}>
          {savingSettings ? "Saving…" : "Save"}
        </button>
      </form>

      <div className="stat-grid">
        <StatCard label="Present" value={presentCount} />
        <StatCard label="Visitors — manual" value={detail?.visitor_count ?? "—"} />
        <StatCard label="Visitors — QR check-ins" value={detail ? detail.visitor_checkins : "—"} />
        <StatCard label="Visitors — present & 'Visitor'" value={visitorsPresent} />
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Search members"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 44 }} />
              <th>Name</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="table-empty">
                  No members found.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.member_id}>
                <td>
                  <input
                    type="checkbox"
                    className="roster-check"
                    checked={r.present}
                    onChange={(e) => toggle(r.member_id, e.target.checked)}
                    aria-label={`Mark ${r.full_name} present`}
                  />
                </td>
                <td>{r.full_name}</td>
                <td>
                  <span className={`badge badge-${r.membership_status.replace(" ", "-").toLowerCase()}`}>
                    {r.membership_status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
