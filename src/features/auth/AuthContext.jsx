import { createContext, useContext, useMemo, useState } from "react";
import { api } from "../../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [username, setUsername] = useState(() => localStorage.getItem("username"));

  async function login(usernameInput, password) {
    const { token: newToken, user } = await api.login(usernameInput, password);
    localStorage.setItem("token", newToken);
    localStorage.setItem("username", user.username);
    setToken(newToken);
    setUsername(user.username);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setToken(null);
    setUsername(null);
  }

  const value = useMemo(
    () => ({ token, username, isAuthenticated: Boolean(token), login, logout }),
    [token, username]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
