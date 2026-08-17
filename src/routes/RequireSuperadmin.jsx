import { Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext.jsx";

// Guards the Dashboard and Users pages. The viewer role also gets in (read-only demo
// access is meant to show the whole app, sidebar included) — the real privilege
// boundary on Users (assigning roles, approving accounts) is enforced separately:
// server-side by requireRole("superadmin") on the write routes, client-side by
// guardAction popups on the approve/activate buttons. Every other role is bounced home.
export default function RequireSuperadmin({ children }) {
  const { role } = useAuth();
  if (role !== "superadmin" && role !== "viewer") return <Navigate to="/" replace />;
  return children;
}
