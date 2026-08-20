import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const PENDING_REVIEW = "ACCOUNT_PENDING_REVIEW";
const ACCOUNT_SUSPENDED = "ACCOUNT_SUSPENDED";

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  // null | "pending" | "suspended" — a dedicated clean screen instead of the raw
  // server error text for these two specific, expected-to-happen states. Initialized
  // from ?blocked= on the URL too: api.js redirects here with that param when an
  // already-logged-in session's account gets deactivated/un-approved mid-use, so the
  // reason is visible immediately instead of just landing back on a blank login form.
  const [blockedScreen, setBlockedScreen] = useState(() => {
    const reason = new URLSearchParams(window.location.search).get("blocked");
    return reason === "suspended" || reason === "pending" ? reason : null;
  });
  const [busy, setBusy] = useState(false);
  const googleButtonRef = useRef(null);

  function handleAuthError(err) {
    if (err.message === PENDING_REVIEW) {
      setBlockedScreen("pending");
      setError(null);
    } else if (err.message === ACCOUNT_SUSPENDED) {
      setBlockedScreen("suspended");
      setError(null);
    } else {
      setError(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      handleAuthError(err);
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
      handleAuthError(err);
    }
  }

  // "Sign in with Google" is optional — only rendered once the site's Google OAuth
  // client ID is configured (VITE_GOOGLE_CLIENT_ID). Loads Google's own script rather
  // than a wrapper package so there's nothing to install for a single button.
  //
  // Depends on blockedScreen (only actually runs once it's back to null) because the
  // "under review"/"suspended" screens replace the whole form — including the button's
  // container div — so googleButtonRef points at a stale, unmounted node once "Back to
  // login" restores the form; this reruns the render call against the fresh node.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || blockedScreen !== null) return;

    function renderButton() {
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
      window.google.accounts.id.renderButton(googleButtonRef.current, { theme: "outline", size: "large", width: 328 });
    }

    if (window.google?.accounts?.id) {
      renderButton();
      return;
    }

    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener("load", renderButton, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = renderButton;
    document.body.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockedScreen]);

  if (blockedScreen === "pending") {
    return (
      <div className="card" style={{ maxWidth: 360, margin: "80px auto", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
        <h2 style={{ marginTop: 0 }}>Your account is under review</h2>
        <p style={{ color: "#487474" }}>
          A superadmin needs to approve dashboard access for your account before you can log in. Try again once you've been notified.
        </p>
        <button className="btn secondary" style={{ width: "100%" }} onClick={() => setBlockedScreen(null)}>
          Back to login
        </button>
      </div>
    );
  }

  if (blockedScreen === "suspended") {
    return (
      <div className="card" style={{ maxWidth: 360, margin: "80px auto", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🚫</div>
        <h2 style={{ marginTop: 0 }}>Your account is suspended</h2>
        <p style={{ color: "#487474" }}>Please contact the superadmin to have dashboard access restored.</p>
        <button className="btn secondary" style={{ width: "100%" }} onClick={() => setBlockedScreen(null)}>
          Back to login
        </button>
      </div>
    );
  }

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
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0", color: "#487474", fontSize: 12 }}>
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
