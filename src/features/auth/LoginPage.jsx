import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const googleButtonRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleCredential(response) {
    setError(null);
    try {
      await loginWithGoogle(response.credential);
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  }

  // "Sign in with Google" is optional — only rendered once the site's Google OAuth
  // client ID is configured (VITE_GOOGLE_CLIENT_ID). Loads Google's own script rather
  // than a wrapper package so there's nothing to install for a single button.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    function renderButton() {
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
      window.google.accounts.id.renderButton(googleButtonRef.current, { theme: "outline", size: "large", width: 328 });
    }

    if (window.google?.accounts?.id) {
      renderButton();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = renderButton;
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card" style={{ maxWidth: 360, margin: "80px auto" }}>
      <h2 style={{ marginTop: 0 }}>Price Tracker login</h2>
      {error && <div style={{ color: "#a71d1d", marginBottom: 12 }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-row" style={{ flexDirection: "column" }}>
          <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn" type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Logging in..." : "Log in"}
        </button>
      </form>

      {GOOGLE_CLIENT_ID && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0", color: "#9c5b7c", fontSize: 12 }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            OR
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>
          <div ref={googleButtonRef} style={{ display: "flex", justifyContent: "center" }} />
        </>
      )}
    </div>
  );
}
