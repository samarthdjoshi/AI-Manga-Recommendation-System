import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  listActivities,
  createTextActivity,
  toggleLikeActivity,
  createActivityReply,
  deleteActivity,
} from "../api/client";
import { useAuth } from "../context/useAuth";

export default function ActivityFeed({
  initialFeed = "global",
  filterUsername = null,
  feedType = null,
  username = null,
}) {
  const targetUsername = filterUsername || username;
  const targetInitialFeed = feedType || initialFeed;
  const { token, user } = useAuth();
  const [feedMode, setFeedMode] = useState(targetInitialFeed); // "global" | "following" | "user"
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postText, setPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyTextMap, setReplyTextMap] = useState({});
  const [replyOpenMap, setReplyOpenMap] = useState({});

  useEffect(() => {
    let cancelled = false;

    async function loadActivities() {
      try {
        const data = await listActivities({
          feed: feedMode,
          username: feedMode === "user" ? (targetUsername || user?.username) : null,
          token,
        });
        if (!cancelled) {
          setActivities(data.activities || []);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    Promise.resolve().then(() => {
      if (!cancelled) setLoading(true);
    });
    loadActivities();
    return () => {
      cancelled = true;
    };
  }, [feedMode, targetUsername, token, user?.username]);

  async function handleCreatePost(e) {
    e.preventDefault();
    if (!token || !postText.trim() || posting) return;
    setPosting(true);
    try {
      const newAct = await createTextActivity(token, postText.trim());
      setActivities((prev) => [newAct, ...prev]);
      setPostText("");
    } catch {
      // silent
    } finally {
      setPosting(false);
    }
  }

  async function handleLike(activityId) {
    if (!token) return;
    try {
      const res = await toggleLikeActivity(token, activityId);
      setActivities((prev) =>
        prev.map((act) =>
          act.id === activityId
            ? { ...act, is_liked: res.is_liked, like_count: res.like_count }
            : act
        )
      );
    } catch {
      // silent
    }
  }

  async function handleReplySubmit(activityId) {
    const text = replyTextMap[activityId];
    if (!token || !text || !text.trim()) return;
    try {
      const newReply = await createActivityReply(token, activityId, text.trim());
      setActivities((prev) =>
        prev.map((act) =>
          act.id === activityId
            ? {
                ...act,
                replies_count: (act.replies_count || 0) + 1,
                replies: [...(act.replies || []), newReply],
              }
            : act
        )
      );
      setReplyTextMap((prev) => ({ ...prev, [activityId]: "" }));
    } catch {
      // silent
    }
  }

  async function handleDelete(activityId) {
    if (!token) return;
    try {
      await deleteActivity(token, activityId);
      setActivities((prev) => prev.filter((a) => a.id !== activityId));
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

  return (
    <div className="space-y-4">
      {/* Top Filter Tabs & Post Composer */}
      {!targetUsername && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-surface border border-border">
            {[
              { id: "global", label: "Global" },
              { id: "following", label: "Following" },
              { id: "user", label: "My Posts" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFeedMode(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  feedMode === tab.id
                    ? "bg-accent text-accentFg shadow-sm"
                    : "text-muted hover:text-foreground hover:bg-surfaceHover"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Composer Widget (if logged in) */}
      {token && (
        <form onSubmit={handleCreatePost} className="p-4 sm:p-5 rounded-2xl bg-surface border border-border shadow-themeCard">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-surfaceHover border border-border overflow-hidden flex items-center justify-center shrink-0 font-bold text-sm text-accent">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                user?.username ? user.username[0].toUpperCase() : "U"
              )}
            </div>
            <div className="flex-1 space-y-3">
              <textarea
                rows={3}
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="Write a status update, share a manga thought, or ask a question..."
                className="w-full rounded-xl bg-surfaceHover/80 border border-border p-3.5 text-sm text-foreground placeholder-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none transition"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">
                  {postText.length > 0 && `${postText.length} characters`}
                </span>
                <button
                  type="submit"
                  disabled={!postText.trim() || posting}
                  className="px-5 py-2 rounded-xl bg-accent text-accentFg text-xs font-bold hover:brightness-110 active:scale-95 transition min-h-[38px] shadow-sm disabled:opacity-40 cursor-pointer"
                >
                  {posting ? "Posting..." : "Publish Post"}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Activities Stream */}
      {loading ? (
        <div className="py-12 text-center text-xs text-muted animate-pulse">Loading activity stream...</div>
      ) : activities.length === 0 ? (
        <div className="py-12 text-center rounded-2xl bg-surface border border-dashed border-border p-6 space-y-1.5">
          <p className="text-sm font-bold text-foreground">No activities found</p>
          <p className="text-xs text-muted">
            {feedMode === "following"
              ? "Follow other users to see their reading progress and thoughts here."
              : "Post the first status update or track manga chapters to generate activity!"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((act) => {
            const isOwn = user && user.id === act.user_id;
            const repliesOpen = replyOpenMap[act.id];

            return (
              <div
                key={act.id}
                className="p-4 sm:p-5 rounded-2xl bg-surface border border-border shadow-themeCard transition hover:border-accent/40"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surfaceHover border border-border overflow-hidden flex items-center justify-center shrink-0 font-bold text-sm text-accent">
                      {act.avatar_url ? (
                        <img src={act.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        act.username ? act.username[0].toUpperCase() : "U"
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/user/${encodeURIComponent(act.username || "")}`}
                          className="text-sm font-bold text-foreground hover:text-accent transition"
                        >
                          {act.username}
                        </Link>
                        {act.type === "manga_list" && (
                          <span className="px-2 py-0.5 rounded-md bg-accentSoft text-accent font-bold text-[10px] uppercase tracking-wider border border-accent/20">
                            Progress
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted">{formatTime(act.created_at)}</span>
                    </div>
                  </div>

                  {isOwn && (
                    <button
                      type="button"
                      onClick={() => handleDelete(act.id)}
                      className="text-muted hover:text-red-400 text-xs p-1.5 rounded-lg hover:bg-surfaceHover transition"
                      title="Delete activity"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Content */}
                <div className="mt-3.5 text-sm text-foreground leading-relaxed">
                  {act.type === "manga_list" ? (
                    <div className="p-3.5 rounded-xl bg-surfaceHover/70 border border-border flex items-center gap-2.5 flex-wrap">
                      <span className="text-accent font-bold">📖 Read Chapter {act.progress}</span>
                      <span className="text-muted">of</span>
                      <Link to={`/manga/${encodeURIComponent(act.gold_id)}`} className="text-foreground font-bold hover:text-accent hover:underline">
                        {act.gold_id}
                      </Link>
                    </div>
                  ) : (
                    <p className="whitespace-pre-line text-sm text-foreground">{act.text}</p>
                  )}
                </div>

                {/* Footer Controls: Like & Reply */}
                <div className="mt-4 pt-3 border-t border-border flex items-center gap-4 text-xs">
                  <button
                    type="button"
                    onClick={() => handleLike(act.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition hover:bg-surfaceHover ${
                      act.is_liked ? "text-red-500 bg-red-500/10" : "text-muted hover:text-foreground"
                    }`}
                  >
                    <span>{act.is_liked ? "❤️" : "🤍"}</span>
                    <span>{act.like_count || 0}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReplyOpenMap((prev) => ({ ...prev, [act.id]: !prev[act.id] }))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-muted hover:text-foreground hover:bg-surfaceHover font-bold transition"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span>{act.replies_count || 0} Replies</span>
                  </button>
                </div>

                {/* Replies Thread */}
                {repliesOpen && (
                  <div className="mt-3.5 pt-3.5 border-t border-border space-y-3">
                    {act.replies && act.replies.length > 0 && (
                      <div className="space-y-2.5">
                        {act.replies.map((rep) => (
                          <div key={rep.id} className="p-3 rounded-xl bg-surfaceHover/80 border border-border flex items-start gap-3">
                            <div className="w-7 h-7 rounded-lg bg-surface border border-border overflow-hidden flex items-center justify-center shrink-0 font-bold text-xs text-accent">
                              {rep.avatar_url ? (
                                <img src={rep.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                rep.username ? rep.username[0].toUpperCase() : "U"
                              )}
                            </div>
                            <div className="flex-1 min-w-0 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-foreground text-xs">{rep.username}</span>
                                <span className="text-[10px] text-muted">{formatTime(rep.created_at)}</span>
                              </div>
                              <p className="text-foreground/90 mt-1 text-xs whitespace-pre-line leading-relaxed">{rep.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Composer */}
                    {token && (
                      <div className="flex items-center gap-2 mt-2 pt-1">
                        <input
                          type="text"
                          value={replyTextMap[act.id] || ""}
                          onChange={(e) => setReplyTextMap((prev) => ({ ...prev, [act.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleReplySubmit(act.id);
                            }
                          }}
                          placeholder="Write a reply..."
                          className="flex-1 rounded-xl bg-surfaceHover border border-border px-3.5 py-2 text-xs text-foreground placeholder-muted focus:outline-none focus:border-accent"
                        />
                        <button
                          type="button"
                          onClick={() => handleReplySubmit(act.id)}
                          className="px-4 py-2 rounded-xl bg-accent text-accentFg text-xs font-bold hover:brightness-110 active:scale-95 transition shadow-sm"
                        >
                          Reply
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
