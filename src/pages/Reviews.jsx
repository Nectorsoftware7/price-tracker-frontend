import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import Loader from "../components/Loader.jsx";
import { Pager, usePagination } from "../components/Pager.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";

const TABS = [
  { key: "shopify", label: "Shopify" },
  { key: "woocommerce", label: "WooCommerce" },
];

function initials(name, email) {
  const source = (name || email || "?").trim();
  const parts = source.split(/[\s.@_-]+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}

// Just the clock time, the way a messaging app stamps a bubble — the full date already
// sits in the conversation header, so repeating it on every message is noise.
function bubbleTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// One message. Which side it sits on is the whole encoding: the customer on the left,
// anything we sent on the right.
function Bubble({ side, label, time, children, footer }) {
  return (
    <div className={`bubble-row ${side}`}>
      <div className="bubble">
        {label && <div className="bubble-label">{label}</div>}
        <div className="bubble-text">{children}</div>
        <div className="bubble-meta">
          {footer}
          {time && <span className="bubble-time">{time}</span>}
        </div>
      </div>
    </div>
  );
}

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

  const canReply = Boolean(submission.email);

  return (
    <div className="card chat-card">
      <header className="chat-head">
        <span className="chat-avatar">{initials(submission.name, submission.email)}</span>
        <div className="chat-who">
          <strong>{submission.name || "Unknown"}</strong>
          <span className="chat-contact">
            {[submission.email, submission.phone].filter(Boolean).join(" · ") || "No contact details"}
          </span>
        </div>
        <span className="chat-date">{new Date(submission.createdAt).toLocaleDateString()}</span>
      </header>

      <div className="chat-thread">
        <Bubble side="in" time={bubbleTime(submission.createdAt)}>
          {submission.message || <em className="muted">No message text found</em>}
        </Bubble>

        {submission.aiReply && (
          <Bubble
            side="out"
            label="AI reply"
            time={bubbleTime(submission.createdAt)}
            footer={
              submission.emailSent ? (
                <span className="delivery sent">Emailed</span>
              ) : (
                // The raw provider error used to be printed in full inside the bubble,
                // which buried the reply itself under a paragraph of API guidance. The
                // state belongs in a chip; the detail belongs on hover, where someone
                // debugging can still reach it.
                <span className="delivery failed" title={submission.emailError || "Not sent"}>
                  Not delivered
                </span>
              )
            }
          >
            {submission.aiReply}
          </Bubble>
        )}

        {submission.manualReply && (
          <Bubble side="out" label="Your reply" time={bubbleTime(submission.manualReplySentAt)}>
            {submission.manualReply}
          </Bubble>
        )}
      </div>

      <div className="chat-composer">
        <input
          placeholder={canReply ? "Type a reply…" : "No email on this submission — can't reply"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!canReply}
          onKeyDown={(e) => e.key === "Enter" && guardAction(handleSend)()}
        />
        <button
          className="chat-send"
          aria-label="Send reply"
          onClick={guardAction(handleSend)}
          disabled={!canReply || sending || !draft.trim()}
        >
          {sending ? "…" : "➤"}
        </button>
      </div>
      {error && <p className="chat-error">{error}</p>}
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
  // Ten conversations to a page: each one is a whole thread rather than a table row, so
  // the same 25 that suits a list would be a very long scroll here.
  const { page, pageCount, visible, goToPage, topRef, total, from, to } = usePagination(filtered, {
    pageSize: 10,
    resetKey: tab,
  });

  return (
    <div>
      {/* Paging lands here rather than on the tab row: this page is the list, so its
          heading is the top of it. */}
      <h2 ref={topRef}>Contact form conversations</h2>
      <p style={{ color: "var(--text-muted)", marginTop: -8 }}>
        Every customer question submitted through the website contact forms, the AI's auto-reply, and a place to send your own reply.
      </p>

      <div className="form-row" style={{ marginBottom: 8 }}>
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
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            No {TABS.find((t) => t.key === tab)?.label} contact form submissions yet.
          </p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
            {total} conversation{total === 1 ? "" : "s"}
            {pageCount > 1 ? ` — showing ${from}–${to}` : ""}
          </p>
          {visible.map((s) => (
            <ConversationCard key={s._id} submission={s} onReplySent={handleReplySent} guardAction={guardAction} />
          ))}
          <Pager page={page} pageCount={pageCount} onChange={goToPage} />
        </>
      )}
    </div>
  );
}
