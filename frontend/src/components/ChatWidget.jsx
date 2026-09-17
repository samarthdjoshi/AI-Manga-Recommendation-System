import { Link } from "react-router-dom";
import { useState, useRef, useEffect, useCallback } from "react";
import { sendChatMessage, checkHealth } from "../api/client";
import { useChatPageContext } from "../context/useChatPageContext";

const SUGGESTED_PROMPTS = [
  "Dark fantasy with deep lore",
  "Wholesome romance & comedy",
  "Top rated action manhwa",
  "Psychological mystery with twists",
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [lastUserPrompt, setLastUserPrompt] = useState("");
  const [aiStatus, setAiStatus] = useState("checking");

  // Persistent user preferences
  const [hideExplicit, setHideExplicit] = useState(() => {
    return localStorage.getItem("mangalyst_chat_hide_explicit") !== "false";
  });
  const [hideDoujinshi, setHideDoujinshi] = useState(() => {
    return localStorage.getItem("mangalyst_chat_hide_doujinshi") !== "false";
  });

  const { pageManga } = useChatPageContext();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const toggleBtnRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Check health and live AI status
  useEffect(() => {
    let active = true;
    checkHealth()
      .then((data) => {
        if (active && data) {
          setAiStatus(data.status === "ok" ? "online" : "ready");
        }
      })
      .catch(() => {
        if (active) setAiStatus("ready");
      });
    return () => {
      active = false;
    };
  }, [open]);

  // Focus input on open, return focus on close
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      toggleBtnRef.current?.focus();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
  }, [open]);

  // Keyboard accessibility: close on Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending, open]);

  // Save content filters to localStorage
  const handleToggleExplicit = () => {
    setHideExplicit((prev) => {
      const next = !prev;
      localStorage.setItem("mangalyst_chat_hide_explicit", String(next));
      return next;
    });
  };

  const handleToggleDoujinshi = () => {
    setHideDoujinshi((prev) => {
      const next = !prev;
      localStorage.setItem("mangalyst_chat_hide_doujinshi", String(next));
      return next;
    });
  };

  const executeSend = useCallback(
    async (textToSend) => {
      const text = (textToSend || input).trim();
      if (!text || sending) return;

      setLastUserPrompt(text);
      setInput("");
      setSending(true);

      const nextMessages = [...messages, { role: "user", content: text }];
      setMessages(nextMessages);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const historyPayload = nextMessages.slice(-10).map(({ role, content }) => ({
          role,
          content,
        }));

        const data = await sendChatMessage(
          text,
          historyPayload.slice(0, -1),
          hideExplicit,
          hideDoujinshi,
          pageManga ? pageManga.gold_id : null,
          abortControllerRef.current.signal
        );

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply,
            sources: data.sources || [],
            status: data.status || "ok",
            provider: data.provider,
            suggestions: data.suggestions || [],
          },
        ]);
      } catch (err) {
        if (err.name === "CanceledError" || err.code === "ERR_CANCELED") {
          return;
        }
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Unable to reach the assistant server. Please verify your connection or try again shortly.",
            sources: [],
            status: "error",
            canRetry: true,
          },
        ]);
      } finally {
        setSending(false);
        abortControllerRef.current = null;
      }
    },
    [input, sending, messages, hideExplicit, hideDoujinshi, pageManga]
  );

  function handleSubmit(e) {
    e.preventDefault();
    executeSend();
  }

  function handleRetry() {
    if (lastUserPrompt) {
      executeSend(lastUserPrompt);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mangalyst Assistant"
          className="fixed inset-x-3 bottom-3 top-16 sm:inset-auto sm:bottom-0 sm:right-0 sm:w-[420px] sm:h-[600px] rounded-2xl bg-surface border border-border shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-border bg-surface flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    aiStatus === "online"
                      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"
                      : "bg-accent animate-pulse"
                  }`}
                />
                <span className="font-semibold text-foreground text-sm tracking-tight">
                  Mangalyst Assistant
                </span>
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${
                    aiStatus === "online"
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "bg-accentSoft text-accent border-accent/30"
                  }`}
                >
                  {aiStatus === "online" ? "AI Online" : "Catalog AI"}
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted hover:text-foreground p-1 rounded-lg hover:bg-surfaceHover transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label="Close chat"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content Preferences */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 pt-2 border-t border-border/50">
              <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
                <button
                  type="button"
                  role="switch"
                  aria-checked={hideExplicit}
                  onClick={handleToggleExplicit}
                  className={`relative inline-flex h-3.5 w-7 items-center rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-accent ${
                    hideExplicit ? "bg-accent" : "bg-border"
                  }`}
                  aria-label="Hide explicit and NSFW content"
                >
                  <span
                    className={`inline-block h-2.5 w-2.5 transform rounded-full bg-background transition-transform ${
                      hideExplicit ? "translate-x-3.5" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span>Hide NSFW</span>
              </label>

              <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
                <button
                  type="button"
                  role="switch"
                  aria-checked={hideDoujinshi}
                  onClick={handleToggleDoujinshi}
                  className={`relative inline-flex h-3.5 w-7 items-center rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-accent ${
                    hideDoujinshi ? "bg-accent" : "bg-border"
                  }`}
                  aria-label="Hide doujinshi"
                >
                  <span
                    className={`inline-block h-2.5 w-2.5 transform rounded-full bg-background transition-transform ${
                      hideDoujinshi ? "translate-x-3.5" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span>Hide Doujinshi</span>
              </label>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {messages.length === 0 && (
              <div className="py-4 space-y-4">
                <div className="p-3.5 rounded-xl bg-surfaceHover border border-border text-xs text-foreground/85 leading-relaxed">
                  {pageManga ? (
                    <span>
                      Viewing <strong className="text-accent">{pageManga.title}</strong>. Ask for similar manga, explore its themes, or ask any catalog question.
                    </span>
                  ) : (
                    <span>
                      Welcome to Mangalyst Assistant! Ask for title recommendations, vibe searches, or specific manga details backed by 339k+ titles.
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
                    Suggested searches:
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {pageManga && (
                      <button
                        type="button"
                        onClick={() => executeSend(`Recommend manga similar to ${pageManga.title}`)}
                        className="text-left text-xs px-3 py-2 rounded-lg bg-accentSoft text-accent hover:bg-accent hover:text-black transition-colors border border-accent/20"
                      >
                        ⚡ Similar to &ldquo;{pageManga.title}&rdquo;
                      </button>
                    )}
                    {SUGGESTED_PROMPTS.map((prompt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => executeSend(prompt)}
                        className="text-left text-xs px-3 py-2 rounded-lg bg-surfaceHover hover:bg-border/60 text-foreground transition-colors border border-border/70"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                {/* Fallback Banner for Offline Provider */}
                {m.status === "assistant_unavailable" && (
                  <div className="mb-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2 text-left">
                    <div className="flex items-center gap-1.5">
                      <span>⚠️</span>
                      <span className="font-medium">AI Model Offline &bull; Catalog Search Results:</span>
                    </div>
                    {lastUserPrompt && (
                      <button
                        type="button"
                        onClick={handleRetry}
                        className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 transition-colors"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                )}

                {/* Error Banner */}
                {m.status === "error" && (
                  <div className="mb-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2 text-left">
                    <span>Connection interrupted</span>
                    {lastUserPrompt && (
                      <button
                        type="button"
                        onClick={handleRetry}
                        className="text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 transition-colors"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`inline-block max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs text-left leading-relaxed ${
                    m.role === "user"
                      ? "bg-accent text-black font-medium"
                      : "bg-surfaceHover text-foreground/90 border border-border"
                  }`}
                >
                  {m.content}
                </div>

                {/* Rich Title Cards */}
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-2.5 space-y-2 max-w-full">
                    <span className="text-[11px] font-medium text-muted uppercase tracking-wider block text-left">
                      Recommended Titles ({m.sources.length}):
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {m.sources.map((s) => (
                        <Link
                          key={s.gold_id}
                          to={`/manga/${encodeURIComponent(s.gold_id)}`}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-2.5 p-2 rounded-xl bg-surface border border-border hover:border-accent/60 hover:bg-surfaceHover transition-all text-left group"
                        >
                          <div className="w-10 h-14 rounded-lg bg-ink border border-border/40 flex items-center justify-center text-muted flex-shrink-0 relative overflow-hidden">
                            <span className="text-sm select-none">📖</span>
                            {s.cover_image_url && (
                              <img
                                src={s.cover_image_url}
                                alt={s.title}
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                className="absolute inset-0 w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-xs text-foreground group-hover:text-accent truncate">
                              {s.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted">
                              {s.rating != null && (
                                <span className="text-amber-400 font-medium">
                                  ★ {s.rating.toFixed(1)}
                                </span>
                              )}
                              {s.year && <span>{s.year}</span>}
                              {s.reason && (
                                <span className="text-accent/80 truncate italic">
                                  &bull; {s.reason}
                                </span>
                              )}
                            </div>
                            {s.genres && s.genres.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {s.genres.slice(0, 3).map((g, gi) => (
                                  <span
                                    key={gi}
                                    className="text-[9px] px-1.5 py-0.2 rounded bg-border/60 text-muted font-medium"
                                  >
                                    {g}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions Chips from Fallback */}
                {m.suggestions && m.suggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-left">
                    {m.suggestions.map((sug, si) => (
                      <button
                        key={si}
                        type="button"
                        onClick={() => executeSend(sug)}
                        className="text-[11px] px-2.5 py-1 rounded-full bg-accentSoft text-accent border border-accent/30 hover:bg-accent hover:text-black transition-colors"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Thinking / Sending Indicator */}
            {sending && (
              <div className="text-left">
                <div className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs bg-surfaceHover text-muted border border-border">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0.3s]" />
                  </div>
                  <span>Searching catalog &amp; generating response...</span>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input Form */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-border bg-surface flex gap-2 flex-shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              maxLength={1000}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about manga, themes, or recommendations..."
              disabled={sending}
              className="flex-1 bg-ink border border-border rounded-xl px-3.5 py-2 text-xs text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="bg-accent text-black text-xs font-semibold px-4 py-2 rounded-xl hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        ref={toggleBtnRef}
        onClick={() => setOpen((v) => !v)}
        className="h-14 w-14 rounded-full bg-accent text-black flex items-center justify-center shadow-2xl hover:brightness-110 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
        aria-label={open ? "Close assistant" : "Open Mangalyst Assistant"}
      >
        {open ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>
    </div>
  );
}
