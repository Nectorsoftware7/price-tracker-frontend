import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import Loader from "../components/Loader.jsx";

function ApproveRow({ user, onApprove }) {
  const [role, setRole] = useState("admin");
  const [busy, setBusy] = useState(false);

  async function handleApprove() {
    setBusy(true);
    try {
      await onApprove(user._id, role);
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>{user.username}</td>
      <td>{new Date(user.createdAt).toLocaleString()}</td>
      <td>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="admin">E-commerce Executive</option>
          <option value="superadmin">Superadmin (restricted)</option>
        </select>
      </td>
      <td>
        <button className="btn" onClick={handleApprove} disabled={busy}>
          {busy ? "Approving..." : "Approve"}
        </button>
      </td>
    </tr>
  );
}

export default function Users() {
  const queryClient = useQueryClient();
  const { data: users = [], isLoading: loading, error } = useQuery({ queryKey: ["users"], queryFn: api.getUsers });

  async function handleApprove(id, role) {
    await api.approveUser(id, role);
    queryClient.invalidateQueries({ queryKey: ["users"] });
  }

  if (loading) return <Loader />;

  const pending = users.filter((u) => u.status === "pending");
  const approved = users.filter((u) => u.status === "approved");

  return (
    <div>
      <h2>Users</h2>
      <p style={{ color: "#4c6b8a", marginTop: -8 }}>
        Anyone who signs in with Google for the first time shows up here waiting for a role before they get dashboard access.
      </p>

      {error && <div className="card" style={{ color: "#a71d1d" }}>{error.message}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>⏳ Pending review</h3>
        {pending.length === 0 ? (
          <p style={{ color: "#4c6b8a", margin: 0 }}>No accounts waiting for approval.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <colgroup>
                <col style={{ width: 260 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 200 }} />
                <col style={{ width: 110 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Google email</th>
                  <th>Requested</th>
                  <th>Assign role</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((u) => (
                  <ApproveRow key={u._id} user={u} onApprove={handleApprove} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Approved accounts</h3>
        <div className="table-scroll">
          <table>
            <colgroup>
              <col style={{ width: 260 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 170 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Since</th>
              </tr>
            </thead>
            <tbody>
              {approved.map((u) => (
                <tr key={u._id}>
                  <td>{u.username}</td>
                  <td>{u.role}</td>
                  <td>{new Date(u.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
