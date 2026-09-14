import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import DiscoveryCard from "../components/DiscoveryCard";
import LoadingSpinner from "../components/LoadingSpinner";
import { getTop100Manga } from "../api/client";

export default function Top100Page() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("grid"); // "grid" or "list"

  useEffect(() => {
    let cancelled = false;

    getTop100Manga(100, 1)
      .then((res) => {
        if (!cancelled) {
          setItems(res.results || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load Top 100 rankings. Please try again.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold mb-2">
            <span>🏆</span>
            <span>All-Time Official Rankings</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            Top 100 Manga & Manhwa
          </h1>
          <p className="text-sm text-muted mt-1">
            The 100 highest-rated stories across global community databases, ranked #1 to #100.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-border self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === "grid"
                ? "bg-accent text-accentFg shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            Grid
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === "list"
                ? "bg-accent text-accentFg shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            Leaderboard
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-24">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl bg-surface border border-border text-center text-sm text-rose-400">
          {error}
        </div>
      ) : (
        <>
          {/* Top 3 All-Time Podium Highlights */}
          {items.length >= 3 && viewMode === "grid" && (
            <section className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
              {items.slice(0, 3).map((item, index) => {
                const medals = [
                  { rank: "#1", color: "from-amber-400 via-amber-500 to-yellow-600", border: "border-amber-500/50", glow: "shadow-[0_4px_24px_-4px_rgba(245,158,11,0.25)]", text: "text-amber-400", label: "All-Time Champion" },
                  { rank: "#2", color: "from-slate-300 via-slate-400 to-slate-500", border: "border-slate-400/50", glow: "shadow-[0_4px_24px_-4px_rgba(148,163,184,0.2)]", text: "text-slate-300", label: "Rank #2 All-Time" },
                  { rank: "#3", color: "from-amber-700 via-amber-800 to-yellow-900", border: "border-amber-700/50", glow: "shadow-[0_4px_24px_-4px_rgba(180,83,9,0.2)]", text: "text-amber-500", label: "Rank #3 All-Time" },
                ];
                const medal = medals[index];

                return (
                  <div
                    key={item.external_id || item.gold_id || index}
                    className={`relative rounded-3xl border ${medal.border} ${medal.glow} bg-surface p-4 sm:p-5 flex gap-4 items-center overflow-hidden group hover:scale-[1.02] transition-all duration-200`}
                  >
                    <div className="relative w-24 h-36 rounded-2xl overflow-hidden shrink-0 border border-border/50 shadow-md">
                      {item.cover_url ? (
                        <img
                          src={item.cover_url}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-surfaceHover flex items-center justify-center text-xs text-muted">
                          {item.title}
                        </div>
                      )}
                      <div className={`absolute top-1.5 left-1.5 px-2 py-0.5 rounded-lg text-xs font-black bg-gradient-to-r ${medal.color} text-slate-950 shadow-lg`}>
                        {medal.rank}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className={`text-[11px] font-extrabold uppercase tracking-wider ${medal.text}`}>
                        {medal.label}
                      </div>
                      <Link
                        to={item.gold_id ? `/manga/${encodeURIComponent(item.gold_id)}` : `/browse?q=${encodeURIComponent(item.title)}`}
                        className="font-extrabold text-base sm:text-lg text-foreground hover:text-accent transition line-clamp-2 block leading-snug"
                      >
                        {item.title}
                      </Link>
                      <div className="flex items-center gap-2.5 text-xs text-muted pt-0.5">
                        {item.score != null && (
                          <span className="font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md border border-emerald-400/20">
                            ★ {typeof item.score === "number" ? item.score.toFixed(2) : item.score}
                          </span>
                        )}
                        <span className="uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-surfaceHover text-[10px]">
                          {item.type || "MANGA"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {/* Grid View */}
          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-5 xl:gap-6">
              {items.map((item, idx) => (
                <DiscoveryCard
                  key={item.external_id || item.gold_id || idx}
                  item={item}
                  rank={idx + 1}
                />
              ))}
            </div>
          ) : (
            /* Leaderboard List View */
            <div className="rounded-3xl border border-border bg-surface divide-y divide-border overflow-hidden shadow-themeCard">
              {items.map((item, idx) => {
                const rank = idx + 1;
                const targetLink = item.gold_id
                  ? `/manga/${encodeURIComponent(item.gold_id)}`
                  : `/browse?q=${encodeURIComponent(item.title)}`;

                return (
                  <div
                    key={item.external_id || item.gold_id || idx}
                    className="p-4 sm:p-5 flex items-center justify-between gap-4 sm:gap-6 hover:bg-surfaceHover/60 transition group"
                  >
                    <div className="flex items-center gap-4 sm:gap-5 min-w-0 flex-1">
                      {/* Rank Badge */}
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm ${
                          rank === 1
                            ? "bg-amber-400 text-slate-950 font-black shadow-amber-500/20"
                            : rank === 2
                            ? "bg-slate-300 text-slate-950 font-black"
                            : rank === 3
                            ? "bg-amber-700 text-white font-black"
                            : "bg-surfaceHover text-muted font-bold"
                        }`}
                      >
                        #{rank}
                      </div>

                      {/* Thumbnail Cover */}
                      {item.cover_url && (
                        <Link to={targetLink} className="w-14 h-20 sm:w-16 sm:h-24 rounded-xl overflow-hidden shrink-0 border border-border bg-surfaceHover shadow-sm">
                          <img
                            src={item.cover_url}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </Link>
                      )}

                      {/* Details */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <Link
                          to={targetLink}
                          className="font-extrabold text-sm sm:text-base text-foreground hover:text-accent transition-colors block truncate"
                        >
                          {item.title}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                          {item.type && (
                            <span className="font-bold text-[10px] px-2 py-0.5 rounded-md bg-surfaceHover text-accent uppercase">
                              {item.type}
                            </span>
                          )}
                          <span className="font-medium">{(item.genres || []).slice(0, 3).join(" • ")}</span>
                        </div>
                      </div>
                    </div>

                    {/* Score Pill */}
                    {item.score != null && (
                      <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 font-black text-sm">
                        <span>★</span>
                        <span>{typeof item.score === "number" ? item.score.toFixed(2) : item.score}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
