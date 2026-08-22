import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar.jsx";
import BottomNav from "./BottomNav.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { role } = useAuth();
  const { pathname } = useLocation();
  const mainRef = useRef(null);

  // Every page opens at its top.
  //
  // The window never scrolls here — .main is the scrolling element — so a route change
  // swaps the content while leaving that element's scrollTop exactly where it was. Move
  // from a scrolled-down dashboard to Products and Products opened halfway through its
  // table, which reads as a broken page rather than a preserved position.
  //
  // Keyed on pathname alone, so a query-string change (a filter, say) does not yank the
  // reader back to the top of a page they are already working through. Paging inside a
  // list does its own scrolling and is unaffected — it never changes the route.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  function closeSidebar() {
    setSidebarOpen(false);
  }

  return (
    <div className={`app-shell ${sidebarOpen ? "sidebar-open" : ""}`}>
      <Navbar onToggleSidebar={() => setSidebarOpen((open) => !open)} />

      {sidebarOpen && <div className="sidebar-backdrop" onClick={closeSidebar} />}

      <aside className="sidebar">
        <nav>
          {(role === "superadmin" || role === "viewer") && (
            <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "active" : "")} onClick={closeSidebar}>
              Dashboard
            </NavLink>
          )}
          <NavLink to="/products" className={({ isActive }) => (isActive ? "active" : "")} onClick={closeSidebar}>
            Products
          </NavLink>
          <NavLink to="/price-stock" className={({ isActive }) => (isActive ? "active" : "")} onClick={closeSidebar}>
            Stock status
          </NavLink>
          <NavLink to="/price-analytics" className={({ isActive }) => (isActive ? "active" : "")} onClick={closeSidebar}>
            Price Analytics
          </NavLink>
          <NavLink to="/reviews" className={({ isActive }) => (isActive ? "active" : "")} onClick={closeSidebar}>
            Contact Form
          </NavLink>
          {(role === "superadmin" || role === "viewer") && (
            <NavLink to="/users" className={({ isActive }) => (isActive ? "active" : "")} onClick={closeSidebar}>
              Users
            </NavLink>
          )}
        </nav>
      </aside>
      <main className="main" ref={mainRef}>
        <Outlet />
        <footer className="app-footer">
          &copy; {new Date().getFullYear()} All rights reserved.
        </footer>
      </main>

      <BottomNav />
    </div>
  );
}
