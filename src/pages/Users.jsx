import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import Loader from "../components/Loader.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";

const ROLE_LABELS = { admin: "E-commerce Executive", superadmin: "Superadmin" };

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
          <option value="superadmin">Superadmin</option>
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

function ApprovedRow({ user, onToggleActive }) {
  const [busy, setBusy] = useState(false);

  async function handleToggle() {
    setBusy(true);
    try {
      await onToggleActive(user._id, !user.active);
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>{user.username}</td>
      <td>{ROLE_LABELS[user.role] || user.role}</td>
      <td>{new Date(user.createdAt).toLocaleString()}</td>
      <td>
        <span className={`badge ${user.active ? "in_stock" : "out_of_stock"}`}>
          {user.active ? "Active" : "Inactive"}
        </span>
      </td>
      <td>
        <button className={`btn ${user.active ? "danger" : ""}`} onClick={handleToggle} disabled={busy}>
          {busy ? "..." : user.active ? "Deactivate" : "Activate"}
        </button>
      </td>
    </tr>
  );
}

export default function Users() {
  const { guardAction } = useAuth();
  const queryClient = useQueryClient();
  const { data: users = [], isLoading: loading, error } = useQuery({ queryKey: ["users"], queryFn: api.getUsers });

  async function handleApprove(id, role) {
    await api.approveUser(id, role);
    queryClient.invalidateQueries({ queryKey: ["users"] });
  }

  async function handleToggleActive(id, active) {
    await api.setUserActive(id, active);
    queryClient.invalidateQueries({ queryKey: ["users"] });
  }

  if (loading) return <Loader />;

  const pending = users.filter((u) => u.status === "pending");
  const approved = users.filter((u) => u.status === "approved");

  return (
    <div>
      <h2>Users</h2>
      <p style={{ color: "#487474", marginTop: -8 }}>
        Anyone who signs in with Google for the first time shows up here waiting for a role before they get dashboard access.
      </p>

      {error && <div className="card" style={{ color: "#a71d1d" }}>{error.message}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>⏳ Pending review</h3>
        {pending.length === 0 ? (
          <p style={{ color: "#487474", margin: 0 }}>No accounts waiting for approval.</p>
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
                  <ApproveRow key={u._id} user={u} onApprove={guardAction(handleApprove)} />
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
              <col style={{ width: 190 }} />
              <col style={{ width: 170 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 120 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Since</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {approved.map((u) => (
                <ApprovedRow key={u._id} user={u} onToggleActive={guardAction(handleToggleActive)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
