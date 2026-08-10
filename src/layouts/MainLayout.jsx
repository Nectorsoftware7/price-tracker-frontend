import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext.jsx";

export default function MainLayout() {
  const { logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function closeSidebar() {
    setSidebarOpen(false);
  }

  return (
    <div className={`app-shell ${sidebarOpen ? "sidebar-open" : ""}`}>
      <button
        className="hamburger-btn"
        aria-label={sidebarOpen ? "Close menu" : "Open menu"}
        onClick={() => setSidebarOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>

      {sidebarOpen && <div className="sidebar-backdrop" onClick={closeSidebar} />}

      <aside className="sidebar">
        <h1>Price Tracker</h1>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")} onClick={closeSidebar}>
            Products
          </NavLink>
          <NavLink to="/price-stock" className={({ isActive }) => (isActive ? "active" : "")} onClick={closeSidebar}>
            Price &amp; Stock
          </NavLink>
          <NavLink to="/price-analytics" className={({ isActive }) => (isActive ? "active" : "")} onClick={closeSidebar}>
            Price Analytics
          </NavLink>
          <NavLink to="/reviews" className={({ isActive }) => (isActive ? "active" : "")} onClick={closeSidebar}>
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
