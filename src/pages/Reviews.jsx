import { useEffect, useState } from "react";
import { api } from "../api";

const TABS = [
  { key: "shopify", label: "Shopify" },
  { key: "woocommerce", label: "WooCommerce" },
];

function ConversationCard({ submission, onReplySent }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  async function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const updated = await api.sendManualReply(submission._id, draft.trim());
      setDraft("");
      onReplySent(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card">
      <div className="form-row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <strong>{submission.name || "Unknown"}</strong>
          {submission.email && <span style={{ color: "#4c6b8a" }}> — {submission.email}</span>}
          {submission.phone && <span style={{ color: "#4c6b8a" }}> — {submission.phone}</span>}
        </div>
        <span style={{ color: "#4c6b8a", fontSize: 12 }}>{new Date(submission.createdAt).toLocaleString()}</span>
      </div>

      {/* Customer message bubble */}
      <div style={{ background: "#e3f2fd", borderRadius: 8, padding: "10px 14px", marginBottom: 10, maxWidth: "80%" }}>
        {submission.message || <em style={{ color: "#4c6b8a" }}>No message text found</em>}
      </div>

      {/* AI reply bubble */}
      {submission.aiReply && (
        <div
          style={{
            background: "#dcf5e3",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 10,
            maxWidth: "80%",
            marginLeft: "auto",
          }}
        >
          <div style={{ fontSize: 11, color: "#1c7a3c", marginBottom: 4 }}>
            🤖 AI reply {submission.emailSent ? "(emailed)" : submission.emailError ? `(email failed: ${submission.emailError})` : ""}
          </div>
          {submission.aiReply}
        </div>
      )}

      {/* Manual reply bubble, if one was sent */}
      {submission.manualReply && (
        <div
          style={{
            background: "#d6e9fb",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 10,
            maxWidth: "80%",
            marginLeft: "auto",
          }}
        >
          <div style={{ fontSize: 11, color: "#0d47a1", marginBottom: 4 }}>
            ✍️ Manual reply — {new Date(submission.manualReplySentAt).toLocaleString()}
          </div>
          {submission.manualReply}
        </div>
      )}

      {/* Reply-from-here box */}
      <div className="form-row" style={{ marginTop: 8 }}>
        <input
          placeholder={submission.email ? "Type a reply and send..." : "No email on this submission — can't reply"}
          style={{ flex: 1 }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!submission.email}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button className="btn" onClick={handleSend} disabled={!submission.email || sending || !draft.trim()}>
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
      {error && <p style={{ color: "#a71d1d", fontSize: 13, marginTop: 6 }}>{error}</p>}
    </div>
  );
}

export default function Reviews() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("shopify");

  async function load() {
    setLoading(true);
    try {
      setSubmissions(await api.getContactSubmissions());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleReplySent(updated) {
    setSubmissions((prev) => prev.map((s) => (s._id === updated._id ? { ...s, ...updated } : s)));
  }

  const filtered = submissions.filter((s) => s.platform === tab);

  return (
    <div>
      <h2>Contact form conversations</h2>
      <p style={{ color: "#4c6b8a", marginTop: -8 }}>
        Every customer question submitted through the website contact forms, the AI's auto-reply, and a place to send your own reply.
      </p>

      <div className="form-row" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t.key} className={`btn ${tab === t.key ? "" : "secondary"}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="card" style={{ color: "#a71d1d" }}>{error}</div>}

      {loading ? (
        <p>Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="card">
          <p style={{ color: "#4c6b8a", margin: 0 }}>No {TABS.find((t) => t.key === tab)?.label} contact form submissions yet.</p>
        </div>
      ) : (
        filtered.map((s) => <ConversationCard key={s._id} submission={s} onReplySent={handleReplySent} />)
      )}
    </div>
  );
}
