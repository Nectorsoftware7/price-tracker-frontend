import { Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext.jsx";

// "/" is a landing spot, not a page: each role gets sent to whichever page is actually
// its home.
//
// Products used to render at "/" directly, with this redirect wrapped around it to send
// superadmin and viewer to the dashboard instead. That put the landing rule and the only
// route Products had on the same path, so the sidebar's Products link — which pointed at
// "/" — bounced those roles straight back to the dashboard. Products was unreachable for
// them, not just non-default. Splitting the two apart fixes it: the landing choice stays
// here, and Products lives at its own /products.
export default function HomeRedirect() {
  const { role } = useAuth();
  const home = role === "superadmin" || role === "viewer" ? "/dashboard" : "/products";
  return <Navigate to={home} replace />;
}
