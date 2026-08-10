import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext.jsx";

export default function Navbar({ onToggleSidebar }) {
  const { isAuthenticated, username, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const initial = (username || "?").charAt(0).toUpperCase();

  return (
    <header className="navbar">
      <button className="hamburger-btn navbar-hamburger" aria-label="Toggle menu" onClick={onToggleSidebar}>
        <span />
        <span />
        <span />
      </button>

      <Link to="/" className="navbar-brand">
        Price Tracker
      </Link>

      <div className="navbar-profile" ref={menuRef}>
        <button className="avatar-btn" aria-label="Account menu" onClick={() => setMenuOpen((open) => !open)}>
          {initial}
        </button>
        {menuOpen && (
          <div className="avatar-menu">
            <div className="avatar-menu-status">
              {isAuthenticated ? (
                <>
                  <span className="avatar-menu-dot online" />
                  Logged in{username ? ` as ${username}` : ""}
                </>
              ) : (
                <>
                  <span className="avatar-menu-dot" />
                  Not logged in
                </>
              )}
            </div>
            {isAuthenticated ? (
              <button className="btn danger" style={{ width: "100%" }} onClick={logout}>
                Log out
              </button>
            ) : (
              <Link className="btn" style={{ width: "100%", textAlign: "center", display: "block" }} to="/login">
                Log in
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
