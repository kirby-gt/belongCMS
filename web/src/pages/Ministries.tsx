import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";

interface Ministry {
  id: string;
  name: string;
  member_count: number;
}

export default function Ministries() {
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    api
      .getMinistries()
      .then(setMinistries)
      .catch((err) => setError(err.message || "Failed to load ministries"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await api.createMinistry({ name: name.trim() });
      setName("");
      load();
    } catch (err: any) {
      setError(err.message || "Failed to add ministry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Ministries</h1>
      </div>

      {error && <p className="error">{error}</p>}

      <form className="inline-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="New ministry or department name (e.g. Choir)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={saving || !name.trim()}>
          {saving ? "Adding…" : "Add ministry"}
        </button>
      </form>

      {loading ? (
        <p>Loading…</p>
      ) : ministries.length === 0 ? (
        <div className="checkin-empty">No ministries yet. Add one above.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Members</th>
              </tr>
            </thead>
            <tbody>
              {ministries.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{m.member_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
