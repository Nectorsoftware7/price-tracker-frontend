import { useEffect, useState } from "react";
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

// Today gets a time, anything older gets a date — the same rule a messaging app uses on
// its conversation list, because "14:32" on a three-week-old thread tells you nothing.
function listStamp(value) {
  if (!value) return "";
  const date = new Date(value);
  const sameDay = new Date().toDateString() === date.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { day: "2-digit", month: "short" });
}

// The last thing said, whoever said it — which is what the list preview should show.
function lastMessage(submission) {
  if (submission.manualReply) return { text: submission.manualReply, mine: true, at: submission.manualReplySentAt };
  if (submission.aiReply) return { text: submission.aiReply, mine: true, at: submission.createdAt };
  return { text: submission.message || "No message text", mine: false, at: submission.createdAt };
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

function ConversationView({ submission, onReplySent, guardAction, onBack }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  // A draft belongs to the thread it was typed in, not to the pane — switching
  // conversations must not carry half a sentence across to someone else.
  useEffect(() => {
    setDraft("");
    setError(null);
  }, [submission._id]);

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
    <div className="chat-pane">
      <header className="chat-head">
        {/* Only reachable on a narrow screen, where the list and the thread take turns
            using the whole width. */}
        <button className="chat-back" onClick={onBack} aria-label="Back to conversations">
          ‹
        </button>
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
                // The provider's full error used to be printed inside the bubble, burying
                // the reply under a paragraph of API guidance. The state belongs on a
                // chip; the detail belongs on hover, where someone debugging can reach it.
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
  const [openId, setOpenId] = useState(null);

  function handleReplySent(updated) {
    queryClient.setQueryData(["contactSubmissions"], (prev = []) =>
      prev.map((s) => (s._id === updated._id ? { ...s, ...updated } : s))
    );
  }

  const filtered = submissions.filter((s) => s.platform === tab);
  const { page, pageCount, visible, goToPage, topRef, total, from, to } = usePagination(filtered, {
    pageSize: 12,
    resetKey: tab,
  });

  // On a wide screen the thread pane should never sit empty while conversations are
  // listed beside it, so the first one opens by itself. On a narrow screen it must stay
  // closed — there the list is the page, and opening a thread would skip straight past it.
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 860px)").matches;
    if (narrow || visible.length === 0) return;
    if (!visible.some((s) => s._id === openId)) setOpenId(visible[0]._id);
  }, [visible, openId]);

  const open = filtered.find((s) => s._id === openId) || null;

  return (
    <div className="chat-page">
      <h2 ref={topRef}>Contact form conversations</h2>
      <p className="chat-page-lede">
        Every customer question submitted through the website contact forms, the AI's auto-reply, and a place to send your own reply.
      </p>

      {error && <div className="card" style={{ color: "#a71d1d" }}>{error.message}</div>}

      {loading ? (
        <Loader />
      ) : (
        // Two panes side by side, and one at a time below the breakpoint — the thread
        // covers the list there, with the back arrow in its header to return.
        <div className={`chat-layout${open ? " thread-open" : ""}`}>
          <aside className="chat-list">
            <div className="chat-list-head">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  className={`btn ${tab === t.key ? "" : "secondary"}`}
                  onClick={() => {
                    setTab(t.key);
                    setOpenId(null);
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <p className="chat-list-empty">
                No {TABS.find((t) => t.key === tab)?.label} submissions yet.
              </p>
            ) : (
              <>
                <p className="chat-list-count">
                  {total} conversation{total === 1 ? "" : "s"}
                  {pageCount > 1 ? ` — ${from}–${to}` : ""}
                </p>
                <ul className="chat-list-items">
                  {visible.map((s) => {
                    const last = lastMessage(s);
                    return (
                      <li key={s._id}>
                        <button
                          className={`chat-list-item${s._id === openId ? " active" : ""}`}
                          onClick={() => setOpenId(s._id)}
                        >
                          <span className="chat-avatar small">{initials(s.name, s.email)}</span>
                          <span className="chat-list-body">
                            <span className="chat-list-top">
                              <span className="chat-list-name">{s.name || s.email || "Unknown"}</span>
                              <span className="chat-list-time">{listStamp(last.at)}</span>
                            </span>
                            <span className="chat-list-preview">
                              {last.mine && <span className="chat-list-you">You: </span>}
                              {last.text}
                            </span>
                          </span>
                          {s.aiReply && !s.emailSent && !s.manualReply && (
                            <span className="chat-list-flag" title="The reply was not delivered">
                              !
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <Pager page={page} pageCount={pageCount} onChange={goToPage} />
              </>
            )}
          </aside>

          {open ? (
            <ConversationView
              submission={open}
              onReplySent={handleReplySent}
              guardAction={guardAction}
              onBack={() => setOpenId(null)}
            />
          ) : (
            <div className="chat-pane empty">
              <p>{filtered.length === 0 ? "Nothing to show yet." : "Pick a conversation to read it."}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
