import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import Navbar from "./Navbar.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { role } = useAuth();

  function closeSidebar() {
    setSidebarOpen(false);
  }

  return (
    <div className={`app-shell ${sidebarOpen ? "sidebar-open" : ""}`}>
      <Navbar onToggleSidebar={() => setSidebarOpen((open) => !open)} />

      {sidebarOpen && <div className="sidebar-backdrop" onClick={closeSidebar} />}

      <aside className="sidebar">
        <nav>
          {role !== "superadmin" && (
            <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")} onClick={closeSidebar}>
              Products
            </NavLink>
          )}
          <NavLink to="/price-stock" className={({ isActive }) => (isActive ? "active" : "")} onClick={closeSidebar}>
            Price &amp; Stock
          </NavLink>
          <NavLink to="/price-analytics" className={({ isActive }) => (isActive ? "active" : "")} onClick={closeSidebar}>
            Price Analytics
          </NavLink>
          <NavLink to="/reviews" className={({ isActive }) => (isActive ? "active" : "")} onClick={closeSidebar}>
            Contact Form
          </NavLink>
          {role === "superadmin" && (
            <NavLink to="/users" className={({ isActive }) => (isActive ? "active" : "")} onClick={closeSidebar}>
              Users
            </NavLink>
          )}
        </nav>
      </aside>
      <main className="main">
        <Outlet />
        <footer className="app-footer">
          &copy; {new Date().getFullYear()} Nector Foods Pvt Ltd. All rights reserved.
        </footer>
      </main>
    </div>
  );
}
