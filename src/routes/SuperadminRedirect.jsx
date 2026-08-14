import { Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext.jsx";

// The superadmin role only sees Price & Stock, Price Analytics, and Contact Form —
// Products (and its detail page) redirect it away instead of rendering.
export default function SuperadminRedirect({ children }) {
  const { role } = useAuth();
  if (role === "superadmin") return <Navigate to="/price-stock" replace />;
  return children;
}
