import { useState, useEffect, useRef } from "react";
import { listNotifications, markNotificationsReadAll } from "../api/client";
import { useAuth } from "../context/useAuth";

export default function NotificationBell() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;

    async function fetchNotifications() {
      try {
        const data = await listNotifications(token);
        if (!cancelled) {
          setNotifications(data.notifications || []);
          setUnreadCount(data.unread_count || 0);
        }
      } catch {
        // silent
      }
    }

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleMarkAllRead() {
    if (!token || unreadCount === 0) return;
    try {
      await markNotificationsReadAll(token);
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // silent
    }
  }

  function formatTime(isoStr) {
    try {
      const date = new Date(isoStr);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return "";
    }
  }

  if (!token) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (!isOpen && unreadCount > 0) {
            handleMarkAllRead();
          }
        }}
        className="relative p-2 rounded-xl border border-border bg-surfaceHover/60 text-foreground hover:border-accent/40 hover:bg-surfaceHover transition-all flex items-center justify-center text-xs font-medium"
        title="Notifications"
        aria-label="View notifications"
      >
        <svg className="w-4 h-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-black text-black ring-2 ring-ink">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-h-[28rem] overflow-y-auto rounded-2xl bg-surface border border-border shadow-2xl z-50 animate-fadeIn p-3">
          <div className="flex items-center justify-between border-b border-border pb-2.5 mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-accent hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">
              No notifications yet.
            </div>
          ) : (
            <div className="space-y-1.5">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                    n.read
                      ? "border-transparent bg-transparent hover:bg-surfaceHover/60"
                      : "border-accent/30 bg-accentSoft/30"
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center shrink-0 text-xs font-bold overflow-hidden text-accent">
                    {n.actor_avatar_url ? (
                      <img src={n.actor_avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      n.actor_username ? n.actor_username[0].toUpperCase() : "U"
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-xs">
                    <p className="text-foreground leading-snug">
                      <span className="font-bold text-accent">{n.actor_username}</span>{" "}
                      {n.type === "follow" && "started following you."}
                      {n.type === "activity_like" && "liked your activity."}
                      {n.type === "activity_reply" && (
                        <span>replied: &ldquo;{n.text ? n.text.replace(/^[^\s]+ replied to your activity: /, "") : ""}&rdquo;</span>
                      )}
                    </p>
                    <span className="text-[10px] text-muted block mt-0.5">{formatTime(n.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
