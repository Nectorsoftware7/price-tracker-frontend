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

  async function login(usernameInput, password) {
    const { token: newToken, user } = await api.login(usernameInput, password);
    localStorage.setItem("token", newToken);
    localStorage.setItem("username", user.username);
    localStorage.setItem("role", user.role);
    setToken(newToken);
    setUsername(user.username);
    setRole(user.role);
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
    () => ({ token, username, role, isAuthenticated: Boolean(token), login, logout }),
    [token, username, role]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
