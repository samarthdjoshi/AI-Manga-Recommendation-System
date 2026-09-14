import { useState, useMemo } from "react";
import { Link } from "react-router-dom";

function formatScoreBySystem(score, system = "point_10_decimal") {
  if (score == null) return "—";
  if (system === "point_100") {
    return `${Math.round(score * 10)}`;
  }
  if (system === "point_10") {
    return `${Math.round(score)}`;
  }
  if (system === "point_5") {
    const stars = Math.round(score / 2);
    return "★".repeat(Math.min(5, Math.max(1, stars))) + "☆".repeat(Math.max(0, 5 - stars));
  }
  if (system === "point_3") {
    if (score >= 7.5) return "😊";
    if (score >= 5.0) return "😐";
    return "😞";
  }
  return Number(score).toFixed(1);
}

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "reading", label: "Reading" },
  { id: "completed", label: "Completed" },
  { id: "planning", label: "Planning" },
  { id: "paused", label: "Paused" },
  { id: "dropped", label: "Dropped" },
  { id: "re_reading", label: "Re-reading" },
];

const SORT_OPTIONS = [
  { id: "title", label: "Title (A-Z)" },
  { id: "score", label: "Score (Highest)" },
  { id: "progress", label: "Progress (Most Read)" },
  { id: "updated", label: "Last Updated" },
];

export default function MangaListTracker({
  entries = [],
  scoreSystem = "point_10_decimal",
  isOwner = false,
  onIncrement = null,
  incrementingId = null,
}) {
  const [activeStatus, setActiveStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("updated");

  // View mode persistence: "detailed" | "compact" | "covers"
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem("manga_list_view_mode") || "compact";
    } catch {
      return "compact";
    }
  });

  function handleViewModeChange(mode) {
    setViewMode(mode);
    try {
      localStorage.setItem("manga_list_view_mode", mode);
    } catch {
      // ignore
    }
  }

  // Filter & Sort
  const processedEntries = useMemo(() => {
    return entries
      .filter((entry) => {
        // Status filter
        if (activeStatus !== "all") {
          if (activeStatus === "re_reading") {
            if (entry.status !== "re_reading" && entry.status !== "rereading") return false;
          } else if (entry.status !== activeStatus) {
            return false;
          }
        }
        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const title = entry.manga?.title?.toLowerCase() || "";
          const goldId = entry.gold_id.toLowerCase();
          return title.includes(q) || goldId.includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "title") {
          const titleA = a.manga?.title || a.gold_id;
          const titleB = b.manga?.title || b.gold_id;
          return titleA.localeCompare(titleB);
        }
        if (sortBy === "score") {
          return (b.score || 0) - (a.score || 0);
        }
        if (sortBy === "progress") {
          return (b.progress || 0) - (a.progress || 0);
        }
        // Default: updated desc
        const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return dateB - dateA;
      });
  }, [entries, activeStatus, searchQuery, sortBy]);

  return (
    <div className="space-y-6">
      {/* 1. Header Bar: My Manga Library */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            <span>My Manga Library</span>
          </h2>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Organize reading status, track chapter milestones, and rate titles in your personal collection.
          </p>
        </div>
        <div className="text-xs font-bold px-3.5 py-1.5 rounded-xl bg-surface border border-border text-muted shadow-xs self-start sm:self-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-accent" />
          <span>{entries.length} Total Titles Tracked</span>
        </div>
      </div>

      {/* 2. Large Prominent Status Navigation Bar (AniList Library Sections) */}
      <div className="bg-surface border border-border rounded-2xl p-2.5 sm:p-3 shadow-themeCard">
        <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-nowrap sm:flex-wrap">
          {STATUS_TABS.map((s) => {
            const count =
              s.id === "all"
                ? entries.length
                : s.id === "re_reading"
                ? entries.filter((e) => e.status === "re_reading" || e.status === "rereading").length
                : entries.filter((e) => e.status === s.id).length;
            const isSelected = activeStatus === s.id;

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveStatus(s.id)}
                className={`group min-h-[48px] sm:min-h-[52px] px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold uppercase tracking-wider whitespace-nowrap transition-all flex items-center justify-between gap-2.5 shrink-0 sm:shrink cursor-pointer ${
                  isSelected
                    ? "bg-accent text-accentFg shadow-md ring-2 ring-accent/30 border border-accent"
                    : "bg-surfaceHover/60 text-muted hover:text-foreground hover:bg-surfaceHover border border-border/50"
                }`}
              >
                <span>{s.label}</span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-lg font-black transition-colors ${
                    isSelected
                      ? "bg-white/20 text-white shadow-xs"
                      : "bg-surface border border-border/60 text-muted group-hover:text-foreground"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Dedicated Search, Sort & View Controls Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface border border-border rounded-2xl p-3 sm:p-3.5 shadow-sm">
        {/* Left: Search Box */}
        <div className="relative flex-1 sm:max-w-xs">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search within library..."
            className="w-full h-11 bg-surfaceHover border border-border rounded-xl pl-9 pr-8 text-xs sm:text-sm text-foreground placeholder-muted focus:outline-none focus:border-accent font-medium transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-foreground p-1"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Right: Showing count + Sort + View switcher */}
        <div className="flex items-center gap-3 justify-between sm:justify-end">
          <span className="text-xs text-muted font-bold hidden md:inline">
            Showing {processedEntries.length} of {entries.length}
          </span>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-11 bg-surfaceHover border border-border rounded-xl px-3.5 text-xs sm:text-sm text-foreground focus:outline-none focus:border-accent font-bold cursor-pointer transition"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* 3-Mode View Switcher */}
          <div className="h-11 flex items-center gap-1 bg-surfaceHover border border-border p-1 rounded-xl shrink-0">
            {/* 1. Detailed Grid */}
            <button
              type="button"
              onClick={() => handleViewModeChange("detailed")}
              title="Detailed Grid"
              className={`h-9 w-9 rounded-lg flex items-center justify-center transition cursor-pointer ${
                viewMode === "detailed" ? "bg-accent text-accentFg shadow-xs" : "text-muted hover:text-foreground"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>

            {/* 2. Compact List */}
            <button
              type="button"
              onClick={() => handleViewModeChange("compact")}
              title="Compact List Table"
              className={`h-9 w-9 rounded-lg flex items-center justify-center transition cursor-pointer ${
                viewMode === "compact" ? "bg-accent text-accentFg shadow-xs" : "text-muted hover:text-foreground"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* 3. Minimal Cover View */}
            <button
              type="button"
              onClick={() => handleViewModeChange("covers")}
              title="Minimal Cover Gallery"
              className={`h-9 w-9 rounded-lg flex items-center justify-center transition cursor-pointer ${
                viewMode === "covers" ? "bg-accent text-accentFg shadow-xs" : "text-muted hover:text-foreground"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {processedEntries.length === 0 ? (
        <div className="bg-surface border border-dashed border-border rounded-2xl p-12 text-center text-muted space-y-2">
          <div className="text-3xl">📚</div>
          <p className="text-sm font-semibold text-foreground">No manga found in this view.</p>
          <p className="text-xs text-muted">
            {searchQuery
              ? `No titles match your search "${searchQuery}".`
              : "No titles tracked under this status filter."}
          </p>
        </div>
      ) : viewMode === "compact" ? (
        /* MODE 1: COMPACT LIST (AniList high-density table) */
        <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-themeCard">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-border text-muted uppercase tracking-wider font-semibold bg-surfaceHover/80 text-[11px]">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4 w-28 text-center">Score</th>
                  <th className="py-3 px-4 w-36 text-center">Progress</th>
                  <th className="py-3 px-4 w-28 text-center">Type</th>
                  {isOwner && <th className="py-3 px-4 w-24 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {processedEntries.map((entry, idx) => {
                  const m = entry.manga || {};
                  const formattedScore = formatScoreBySystem(entry.score, scoreSystem);
                  const isInc = incrementingId === entry.gold_id;
                  const totalCh = m.chapters;
                  const progPercent = totalCh && totalCh > 0 ? Math.min(100, Math.round((entry.progress / totalCh) * 100)) : null;

                  return (
                    <tr key={entry.gold_id} className="hover:bg-surfaceHover/60 transition">
                      <td className="py-3.5 px-4 text-center text-muted font-bold">{idx + 1}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3.5">
                          <Link
                            to={`/manga/${encodeURIComponent(entry.gold_id)}`}
                            className="w-12 h-16 sm:w-14 sm:h-20 rounded-xl overflow-hidden shrink-0 border border-border/60 bg-surfaceHover block shadow-xs group"
                          >
                            {m.cover_image_url ? (
                              <img src={m.cover_image_url} alt={m.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-muted text-center p-1 font-semibold">
                                {m.title}
                              </div>
                            )}
                          </Link>
                          <div className="min-w-0 flex-1">
                            <Link
                              to={`/manga/${encodeURIComponent(entry.gold_id)}`}
                              className="font-bold text-foreground hover:text-accent transition line-clamp-1 block text-sm sm:text-base"
                            >
                              {m.title || entry.gold_id}
                            </Link>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-surfaceHover border border-border/40 text-muted">
                                {entry.status}
                              </span>
                              {entry.notes && (
                                <span className="text-[11px] text-muted truncate max-w-xs italic">
                                  "{entry.notes}"
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-extrabold text-accent text-sm sm:text-base">{formattedScore}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="space-y-1.5 max-w-[140px] mx-auto">
                          <div className="font-bold text-foreground text-xs sm:text-sm">
                            {entry.progress || 0}
                            <span className="text-muted font-normal"> / {totalCh || "?"}</span>
                          </div>
                          {progPercent != null && (
                            <div className="w-full bg-surfaceHover rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-accent h-full rounded-full transition-all duration-300"
                                style={{ width: `${progPercent}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center uppercase tracking-wider text-[11px] text-muted font-semibold">
                        {m.type || "Manga"}
                      </td>
                      {isOwner && (
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => onIncrement && onIncrement(entry.gold_id)}
                            disabled={isInc}
                            title="Quick Increment +1 Chapter"
                            className="px-4 py-2 rounded-xl bg-accent text-accentFg text-xs font-black hover:brightness-110 active:scale-95 transition shadow-sm disabled:opacity-50 min-h-[40px] min-w-[44px] inline-flex items-center justify-center cursor-pointer"
                          >
                            {isInc ? "..." : "+1"}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewMode === "detailed" ? (
        /* MODE 2: DETAILED GRID */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {processedEntries.map((entry) => {
            const m = entry.manga || {};
            const formattedScore = formatScoreBySystem(entry.score, scoreSystem);
            const isInc = incrementingId === entry.gold_id;
            const totalCh = m.chapters;
            const progPercent = totalCh && totalCh > 0 ? Math.min(100, Math.round((entry.progress / totalCh) * 100)) : null;

            return (
              <div
                key={entry.gold_id}
                className="rounded-2xl border border-border bg-surface p-4 sm:p-5 flex gap-4 items-center shadow-themeCard hover:border-accent/40 transition group"
              >
                <Link
                  to={`/manga/${encodeURIComponent(entry.gold_id)}`}
                  className="w-20 h-28 sm:w-24 sm:h-34 rounded-xl overflow-hidden shrink-0 border border-border/60 bg-surfaceHover relative block shadow-sm"
                >
                  {m.cover_image_url ? (
                    <img src={m.cover_image_url} alt={m.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-muted text-center p-1">
                      {m.title}
                    </div>
                  )}
                  <span className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded-md bg-black/75 text-white font-bold backdrop-blur-xs">
                    ★ {formattedScore}
                  </span>
                </Link>

                <div className="min-w-0 flex-1 space-y-2.5">
                  <div>
                    <Link
                      to={`/manga/${encodeURIComponent(entry.gold_id)}`}
                      className="font-bold text-sm sm:text-base text-foreground hover:text-accent transition line-clamp-1 block"
                    >
                      {m.title || entry.gold_id}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-surfaceHover text-muted border border-border/40">
                        {entry.status}
                      </span>
                      <span className="text-[10px] text-muted uppercase tracking-wider font-semibold">
                        {m.type || "Manga"}
                      </span>
                    </div>
                  </div>

                  {/* Progress & Quick Action */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted">Progress</span>
                      <span className="font-bold text-foreground">
                        {entry.progress || 0} / {totalCh || "?"} ch
                      </span>
                    </div>
                    {progPercent != null && (
                      <div className="w-full bg-surfaceHover rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-accent h-full rounded-full transition-all duration-300"
                          style={{ width: `${progPercent}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {isOwner && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => onIncrement && onIncrement(entry.gold_id)}
                        disabled={isInc}
                        className="px-4 py-2 rounded-xl bg-accent text-accentFg text-xs font-black hover:brightness-110 active:scale-95 transition shadow-sm disabled:opacity-50 flex items-center gap-1.5 min-h-[40px] cursor-pointer"
                      >
                        <span>{isInc ? "Saving..." : "+1 Chapter"}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* MODE 3: MINIMAL COVER VIEW */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
          {processedEntries.map((entry) => {
            const m = entry.manga || {};
            const formattedScore = formatScoreBySystem(entry.score, scoreSystem);

            return (
              <Link
                key={entry.gold_id}
                to={`/manga/${encodeURIComponent(entry.gold_id)}`}
                className="group relative rounded-2xl overflow-hidden border border-border bg-surface aspect-[2/3] block shadow-themeCard hover:border-accent hover:shadow-xl transition"
              >
                {m.cover_image_url ? (
                  <img
                    src={m.cover_image_url}
                    alt={m.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-surfaceHover flex items-center justify-center p-2 text-xs text-muted text-center font-semibold">
                    {m.title}
                  </div>
                )}
                {/* Score badge at top */}
                <div className="absolute top-2 right-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/75 text-white backdrop-blur-xs shadow">
                    ★ {formattedScore}
                  </span>
                </div>
                {/* Always-visible bottom gradient with title and progress */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-6 flex flex-col justify-end text-white">
                  <div className="text-xs font-bold line-clamp-1 group-hover:text-accent transition">
                    {m.title || entry.gold_id}
                  </div>
                  <div className="flex items-center justify-between mt-0.5 text-[10px] text-white/80">
                    <span>Ch. {entry.progress || 0}</span>
                    <span className="uppercase text-[9px] px-1.5 py-0.2 rounded bg-white/20 font-semibold">
                      {entry.status}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
