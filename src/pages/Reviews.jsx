import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import Loader from "../components/Loader.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";

const TABS = [
  { key: "shopify", label: "Shopify" },
  { key: "woocommerce", label: "WooCommerce" },
];

function ConversationCard({ submission, onReplySent, guardAction }) {
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
          {submission.email && <span style={{ color: "#487474" }}> — {submission.email}</span>}
          {submission.phone && <span style={{ color: "#487474" }}> — {submission.phone}</span>}
        </div>
        <span style={{ color: "#487474", fontSize: 12 }}>{new Date(submission.createdAt).toLocaleString()}</span>
      </div>

      {/* Customer message bubble */}
      <div style={{ background: "#e4f2f1", borderRadius: 8, padding: "10px 14px", marginBottom: 10, maxWidth: "80%" }}>
        {submission.message || <em style={{ color: "#487474" }}>No message text found</em>}
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
            background: "#dbeeee",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 10,
            maxWidth: "80%",
            marginLeft: "auto",
          }}
        >
          <div style={{ fontSize: 11, color: "#006969", marginBottom: 4 }}>
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
          onKeyDown={(e) => e.key === "Enter" && guardAction(handleSend)()}
        />
        <button className="btn" onClick={guardAction(handleSend)} disabled={!submission.email || sending || !draft.trim()}>
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
      {error && <p style={{ color: "#a71d1d", fontSize: 13, marginTop: 6 }}>{error}</p>}
    </div>
  );
}

export default function Reviews() {
  const { guardAction } = useAuth();
  const queryClient = useQueryClient();
  const { data: submissions = [], isLoading: loading, error } = useQuery({
    queryKey: ["contactSubmissions"],
    queryFn: api.getContactSubmissions,
  });
  const [tab, setTab] = useState("shopify");

  function handleReplySent(updated) {
    queryClient.setQueryData(["contactSubmissions"], (prev = []) =>
      prev.map((s) => (s._id === updated._id ? { ...s, ...updated } : s))
    );
  }

  const filtered = submissions.filter((s) => s.platform === tab);

  return (
    <div>
      <h2>Contact form conversations</h2>
      <p style={{ color: "#487474", marginTop: -8 }}>
        Every customer question submitted through the website contact forms, the AI's auto-reply, and a place to send your own reply.
      </p>

      <div className="form-row" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t.key} className={`btn ${tab === t.key ? "" : "secondary"}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="card" style={{ color: "#a71d1d" }}>{error.message}</div>}

      {loading ? (
        <Loader />
      ) : filtered.length === 0 ? (
        <div className="card">
          <p style={{ color: "#487474", margin: 0 }}>No {TABS.find((t) => t.key === tab)?.label} contact form submissions yet.</p>
        </div>
      ) : (
        filtered.map((s) => <ConversationCard key={s._id} submission={s} onReplySent={handleReplySent} guardAction={guardAction} />)
      )}
    </div>
  );
}
