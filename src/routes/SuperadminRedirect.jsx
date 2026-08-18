import { Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext.jsx";

// Products (and its detail page) live at "/" for the admin role, but superadmin and
// viewer both land on Dashboard instead — redirect them away from the Products route
// rather than rendering it there.
export default function SuperadminRedirect({ children }) {
  const { role } = useAuth();
  if (role === "superadmin" || role === "viewer") return <Navigate to="/dashboard" replace />;
  return children;
}
