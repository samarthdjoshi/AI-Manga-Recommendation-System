import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listTracking, saveTracking, getManga } from "../api/client";

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

export default function ContinueReadingShelf({ token }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(token));
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    if (!token) return undefined;

    let cancelled = false;

    listTracking(token)
      .then(async (data) => {
        if (cancelled) return;
        const activeEntries = (data.entries || []).filter(
          (e) => e.status === "reading" || e.status === "rereading"
        );

        if (activeEntries.length === 0) {
          setItems([]);
          setLoading(false);
          return;
        }

        // Fetch details for each active tracking item
        const resolved = await Promise.all(
          activeEntries.slice(0, 8).map(async (entry) => {
            try {
              const manga = await getManga(entry.gold_id);
              return { entry, manga };
            } catch {
              return {
                entry,
                manga: { gold_id: entry.gold_id, title: "Tracked Manga", chapters: null },
              };
            }
          })
        );

        if (!cancelled) {
          setItems(resolved);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleQuickAdvance(goldId, currentEntry, totalChapters) {
    if (!token || updatingId) return;
    setUpdatingId(goldId);

    const nextProgress = currentEntry.progress + 1;
    // If chapters known and next progress reaches or exceeds chapters, keep status or leave as is
    const nextStatus =
      totalChapters != null && nextProgress >= totalChapters
        ? "completed"
        : currentEntry.status;

    try {
      const updated = await saveTracking(
        goldId,
        {
          status: nextStatus,
          progress: nextProgress,
          score: currentEntry.score,
          notes: currentEntry.notes,
        },
        token
      );

      // If completed, remove from active shelf; otherwise update progress
      if (nextStatus === "completed") {
        setItems((prev) => prev.filter((item) => item.entry.gold_id !== goldId));
      } else {
        setItems((prev) =>
          prev.map((item) =>
            item.entry.gold_id === goldId
              ? { ...item, entry: { ...item.entry, progress: updated.progress, updated_at: updated.updated_at } }
              : item
          )
        );
      }
    } catch (err) {
      console.error("Failed to advance chapter:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">📖</span>
          <h2 className="text-xl font-extrabold text-foreground tracking-tight">
            Continue Reading
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-surface border border-border animate-pulse"
            />
          ))}
        </div>
      </section>
    );
  }

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center text-base">
            📖
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Continue Reading
            </h2>
            <p className="text-xs text-muted">Pick up right where you left off</p>
          </div>
        </div>
        <Link
          to="/profile"
          className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
        >
          <span>View All Reading</span>
          <span>&rarr;</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        {items.map(({ entry, manga }) => {
          const hasTotal = manga.chapters != null && manga.chapters > 0;
          const progressPercent = hasTotal
            ? Math.min(100, Math.max(0, Math.round((entry.progress / manga.chapters) * 100)))
            : null;
          const isUpdating = updatingId === entry.gold_id;

          return (
            <div
              key={entry.gold_id}
              className="group relative rounded-2xl bg-surface border border-border overflow-hidden hover:border-accent shadow-sm hover:shadow-themeCard transition-all duration-300 p-4 flex gap-4 items-center"
            >
              {/* Thumbnail */}
              <Link
                to={`/manga/${encodeURIComponent(entry.gold_id)}`}
                className="w-20 h-28 sm:w-24 sm:h-32 flex-shrink-0 rounded-xl overflow-hidden bg-ink relative border border-border shadow-sm block group-hover:scale-102 transition"
              >
                <div className="w-full h-full flex items-center justify-center text-base text-muted relative">
                  <span className="select-none">📖</span>
                  {manga.cover_image_url && (
                    <img
                      src={manga.cover_image_url}
                      alt={manga.title}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                </div>
              </Link>

              {/* Info & Progress */}
              <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
                <div>
                  <Link
                    to={`/manga/${encodeURIComponent(entry.gold_id)}`}
                    className="block font-bold text-foreground text-sm sm:text-base truncate group-hover:text-accent transition-colors"
                  >
                    {manga.title}
                  </Link>

                  <div className="flex items-center justify-between text-xs text-muted mt-1.5 font-medium">
                    <span className="font-bold text-foreground">
                      {hasTotal ? `Ch. ${entry.progress} / ${manga.chapters}` : `Ch. ${entry.progress}`}
                    </span>
                    <span className="text-[11px] text-muted">{timeAgo(entry.updated_at)}</span>
                  </div>

                  {/* Progress bar */}
                  {progressPercent != null ? (
                    <div className="w-full h-2 bg-surfaceHover rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  ) : (
                    <div className="h-2 mt-2" />
                  )}
                </div>

                {/* Comfortable Action Buttons */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleQuickAdvance(entry.gold_id, entry, manga.chapters)}
                    className="flex-1 py-2 px-3 rounded-xl bg-accent text-white hover:bg-accentHover transition font-bold text-xs sm:text-sm shadow-md shadow-accent/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <span>+1 Chapter</span>
                    {isUpdating && <span className="animate-spin text-xs">◌</span>}
                  </button>

                  <Link
                    to={`/manga/${encodeURIComponent(entry.gold_id)}`}
                    className="py-2 px-3 rounded-xl bg-surfaceHover border border-border text-foreground hover:border-accent/40 transition font-semibold text-xs text-center shrink-0"
                    title="View manga details"
                  >
                    Details
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
