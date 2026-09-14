import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  listNotifications,
  markNotificationsReadAll,
  deleteNotification,
} from "../api/client";
import { useAuth } from "../context/useAuth";
import LoadingSpinner from "../components/LoadingSpinner";

function timeAgo(dateString) {
  if (!dateString) return "";
  const now = new Date();
  const date = new Date(dateString);
  const diffMinutes = Math.floor((now - date) / (1000 * 60));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "activity_like", label: "Likes" },
  { id: "activity_reply", label: "Replies" },
  { id: "follow", label: "Followers" },
];

export default function NotificationsPage() {
  const { token, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (authLoading || !token) return;
    let cancelled = false;

    listNotifications(token, 50)
      .then((data) => {
        if (!cancelled) {
          setNotifications(data.notifications || []);
          setUnreadCount(data.unread_count || 0);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, authLoading]);

  async function handleMarkAllRead() {
    if (!token || unreadCount === 0 || clearing) return;
    try {
      setClearing(true);
      await markNotificationsReadAll(token);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications read", err);
    } finally {
      setClearing(false);
    }
  }

  async function handleDelete(notifId) {
    if (!token) return;
    try {
      await deleteNotification(token, notifId);
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="py-24">
        <LoadingSpinner />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-4">
        <div className="text-4xl">🔔</div>
        <h1 className="text-2xl font-black text-foreground">Notifications</h1>
        <p className="text-sm text-muted">
          Sign in to your account to view your activity likes, replies, and new follower notifications.
        </p>
        <Link
          to="/login?redirect=/notifications"
          className="inline-block px-5 py-2.5 rounded-xl bg-accent text-accentFg text-xs font-bold hover:bg-accentHover transition shadow-sm"
        >
          Sign In &rarr;
        </Link>
      </div>
    );
  }

  const filtered = notifications.filter((n) => {
    if (activeFilter === "all") return true;
    return n.type === activeFilter;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold mb-2">
            <span>🔔</span>
            <span>Alerts & Social Updates</span>
          </div>
          <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-2">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accentFg font-bold">
                {unreadCount} new
              </span>
            )}
          </h1>
          <p className="text-sm text-muted mt-1">
            Real-time interactions on your published reviews, reading logs, and social profile.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={clearing}
            className="px-4 py-2 rounded-xl bg-surface border border-border hover:border-accent text-xs font-bold text-foreground transition self-start sm:self-auto disabled:opacity-50"
          >
            {clearing ? "Marking read..." : "Mark all as read"}
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface border border-border overflow-x-auto">
        {FILTER_TABS.map((tab) => {
          const isSelected = activeFilter === tab.id;
          const count =
            tab.id === "all"
              ? notifications.length
              : notifications.filter((n) => n.type === tab.id).length;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                isSelected
                  ? "bg-accent text-accentFg shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-white/20 text-white" : "bg-surfaceHover text-muted"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Notification List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-surface/40 space-y-3">
          <div className="text-3xl">📭</div>
          <h3 className="text-sm font-bold text-foreground">No notifications found</h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            When other readers like your status updates, reply to your reviews, or follow your reading journey, you'll see them here.
          </p>
          <Link
            to="/home"
            className="inline-block px-4 py-2 rounded-xl bg-accent text-accentFg text-xs font-bold hover:bg-accentHover transition mt-2"
          >
            Browse Community Activity &rarr;
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-themeCard divide-y divide-border">
          {filtered.map((n) => {
            const isUnread = !n.read;
            const icon =
              n.type === "activity_like"
                ? "❤️"
                : n.type === "activity_reply"
                ? "💬"
                : "👤";

            return (
              <div
                key={n.id}
                className={`p-4 flex items-start justify-between gap-4 transition ${
                  isUnread ? "bg-accent/5" : "hover:bg-surfaceHover/40"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {/* Actor Avatar */}
                  <Link
                    to={`/user/${n.actor_username}`}
                    className="w-10 h-10 rounded-xl bg-surfaceHover border border-border overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-muted hover:border-accent"
                  >
                    {n.actor_avatar_url ? (
                      <img
                        src={n.actor_avatar_url}
                        alt={n.actor_username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      n.actor_username ? n.actor_username[0].toUpperCase() : "U"
                    )}
                  </Link>

                  {/* Body Text */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-xs text-foreground leading-relaxed">
                      <Link
                        to={`/user/${n.actor_username}`}
                        className="font-bold hover:text-accent mr-1"
                      >
                        {n.actor_username}
                      </Link>
                      <span>{n.text}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted">
                      <span>{icon}</span>
                      <span>{timeAgo(n.created_at)}</span>
                      {isUnread && (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => handleDelete(n.id)}
                  title="Remove notification"
                  className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surfaceHover transition text-xs shrink-0"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
