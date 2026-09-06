import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function MembersList() {
  const [members, setMembers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    const params: Record<string, string> = { page: String(page), page_size: String(pageSize) };
    if (search) params.search = search;
    if (status) params.status = status;
    api.getMembers(params).then((res) => {
      setMembers(res.data);
      setTotal(res.total);
    });
  }, [search, status, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="page">
      <div className="page-header">
        <h1>Members</h1>
        <Link to="/members/new" className="btn-primary">
          Add member
        </Link>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Search by name"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="">All statuses</option>
          <option>Visitor</option>
          <option>New convert</option>
          <option>Member</option>
          <option>Inactive</option>
        </select>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Household</th>
              <th>Status</th>
              <th>Phone</th>
              <th>Date joined</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  <Link to={`/members/${m.id}`} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {m.photo_url ? (
                      <img
                        src={`${import.meta.env.VITE_API_URL || "http://localhost:3001"}${m.photo_url}`}
                        alt={m.full_name}
                        style={{ width: 32, height: 32, objectFit: "cover" }}
                      />
                    ) : (
                      <span className="name-avatar">
                        {m.full_name
                          ?.split(" ")
                          .map((p: string) => p[0])
                          .filter(Boolean)
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </span>
                    )}
                    {m.full_name}
                  </Link>
                </td>
                <td>{m.household_name || "—"}</td>
                <td>
                  <span className={`badge badge-${m.membership_status.replace(" ", "-").toLowerCase()}`}>
                    {m.membership_status}
                  </span>
                </td>
                <td>{m.phone || "—"}</td>
                <td>{m.date_joined ? new Date(m.date_joined).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          ‹ Previous
        </button>
        <span>
          Page {page} of {totalPages} ({total} members)
        </span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next ›
        </button>
      </div>
    </div>
  );
}
