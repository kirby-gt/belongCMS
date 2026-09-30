import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";

interface Household {
  id: string;
  name: string;
  address: string | null;
  member_count: number;
}

export default function Households() {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    api
      .getHouseholds()
      .then(setHouseholds)
      .catch((err) => setError(err.message || "Failed to load households"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await api.createHousehold({ name: name.trim(), address: address.trim() || undefined });
      setName("");
      setAddress("");
      load();
    } catch (err: any) {
      setError(err.message || "Failed to add household");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Households</h1>
      </div>

      {error && <p className="error">{error}</p>}

      <form className="inline-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Household name (e.g. Adams family)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Address (optional)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={saving || !name.trim()}>
          {saving ? "Adding…" : "Add household"}
        </button>
      </form>

      {loading ? (
        <p>Loading…</p>
      ) : households.length === 0 ? (
        <div className="checkin-empty">No households yet. Add one above.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
                <th>Members</th>
              </tr>
            </thead>
            <tbody>
              {households.map((h) => (
                <tr key={h.id}>
                  <td>{h.name}</td>
                  <td>{h.address || "—"}</td>
                  <td>{h.member_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
