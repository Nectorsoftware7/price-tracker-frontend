import { createContext, useContext, useMemo, useState } from "react";
import { api } from "../../api";

const AuthContext = createContext(null);

// A role logged in before the backend started sending one got saved as the literal
// string "undefined" (localStorage.setItem stringifies its value) — treat that (and
// "null") the same as no role at all instead of a real, unmatched role name.
function readStoredRole() {
  const stored = localStorage.getItem("role");
  return stored && stored !== "undefined" && stored !== "null" ? stored : null;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [username, setUsername] = useState(() => localStorage.getItem("username"));
  const [role, setRole] = useState(readStoredRole);
  const [viewerBlockedOpen, setViewerBlockedOpen] = useState(false);
  const isViewer = role === "viewer";

  // Every write action in the app calls this instead of running directly — all
  // buttons stay visible for a viewer (so they can see exactly what the full app
  // offers), but the action itself never runs; a popup explains why instead of the
  // button silently doing nothing. The real, unbypassable block is server-side
  // (blockViewer middleware) — this is just the UI half of that same rule.
  function guardAction(action) {
    return (...args) => {
      if (isViewer) {
        setViewerBlockedOpen(true);
        return;
      }
      return action(...args);
    };
  }

  function applySession(newToken, user) {
    localStorage.setItem("token", newToken);
    localStorage.setItem("username", user.username);
    localStorage.setItem("role", user.role);
    setToken(newToken);
    setUsername(user.username);
    setRole(user.role);
  }

  async function login(usernameInput, password) {
    const { token: newToken, user } = await api.login(usernameInput, password);
    applySession(newToken, user);
  }

  async function loginWithGoogle(credential) {
    const { token: newToken, user } = await api.googleLogin(credential);
    applySession(newToken, user);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    setToken(null);
    setUsername(null);
    setRole(null);
  }

  const value = useMemo(
    () => ({ token, username, role, isViewer, isAuthenticated: Boolean(token), login, loginWithGoogle, logout, guardAction }),
    [token, username, role]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {viewerBlockedOpen && (
        <div className="viewer-blocked-overlay" onClick={() => setViewerBlockedOpen(false)}>
          <div className="viewer-blocked-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>View-only account</h3>
            <p style={{ color: "#4c6b8a" }}>
              This account is only for viewing. Editing, deleting, adding, and other write actions are disabled.
            </p>
            <button className="btn" onClick={() => setViewerBlockedOpen(false)}>OK</button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
