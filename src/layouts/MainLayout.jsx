import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext.jsx";

export default function MainLayout() {
  const { logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Price Tracker</h1>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Products
          </NavLink>
          <NavLink to="/price-stock" className={({ isActive }) => (isActive ? "active" : "")}>
            Price &amp; Stock
          </NavLink>
          <NavLink to="/price-analytics" className={({ isActive }) => (isActive ? "active" : "")}>
            Price Analytics
          </NavLink>
          <NavLink to="/reviews" className={({ isActive }) => (isActive ? "active" : "")}>
            Contact Form
          </NavLink>
        </nav>
        <button className="btn secondary" style={{ marginTop: 24, width: "100%" }} onClick={logout}>
          Log out
        </button>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
