import { Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext.jsx";

// The Users approval page is a real privilege boundary (assigning roles), so only the
// superadmin role can reach it — everyone else gets bounced to the home route.
export default function RequireSuperadmin({ children }) {
  const { role } = useAuth();
  if (role !== "superadmin") return <Navigate to="/" replace />;
  return children;
}
