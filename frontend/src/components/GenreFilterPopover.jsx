import { useState, useRef, useEffect, useMemo } from "react";

export default function GenreFilterPopover({
  allGenres = [],
  included = [],
  excluded = [],
  matchMode = "and",
  onChangeIncluded,
  onChangeExcluded,
  onMatchModeChange,
  className = "",
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  const totalSelected = included.length + excluded.length;

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape" && open) {
        setOpen(false);
        containerRef.current?.querySelector("button")?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const filteredGenres = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allGenres;
    return allGenres.filter((g) => g.toLowerCase().includes(q));
  }, [allGenres, search]);

  function toggleInclude(genre) {
    if (included.includes(genre)) {
      onChangeIncluded(included.filter((g) => g !== genre));
    } else {
      // Remove from excluded if present
      if (excluded.includes(genre)) {
        onChangeExcluded(excluded.filter((g) => g !== genre));
      }
      onChangeIncluded([...included, genre]);
    }
  }

  function toggleExclude(genre) {
    if (excluded.includes(genre)) {
      onChangeExcluded(excluded.filter((g) => g !== genre));
    } else {
      // Remove from included if present
      if (included.includes(genre)) {
        onChangeIncluded(included.filter((g) => g !== genre));
      }
      onChangeExcluded([...excluded, genre]);
    }
  }

  function clearAll() {
    onChangeIncluded([]);
    onChangeExcluded([]);
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
        Genres
      </span>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 rounded-xl bg-ink border border-border text-foreground font-medium transition-all duration-200 hover:border-accent/60 hover:bg-surfaceHover focus:outline-none focus:ring-1 focus:ring-accent ${
          compact ? "px-2.5 py-1.5 text-xs min-h-[36px]" : "px-3.5 py-2.5 text-sm min-h-[44px]"
        } ${totalSelected > 0 ? "border-accent/60 text-accent font-semibold" : ""}`}
      >
        <span className="truncate flex items-center gap-1.5">
          <span>{totalSelected === 0 ? "Any Genre" : `${totalSelected} Selected`}</span>
          {totalSelected > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-accent text-black text-[10px] font-bold">
              {totalSelected}
            </span>
          )}
        </span>
        <svg
          className={`h-4 w-4 text-muted transition-transform duration-200 shrink-0 ${
            open ? "rotate-180 text-accent" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 w-[92vw] sm:w-[420px] max-w-[420px] bg-surface border border-border rounded-2xl shadow-2xl z-50 p-4 animate-fadeIn">
          {/* Header with Search and Match Mode */}
          <div className="space-y-3 pb-3 border-b border-border">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-foreground">Filter by Genre</span>
              {/* Match Mode Toggle */}
              <div className="inline-flex items-center rounded-lg bg-ink p-0.5 border border-border text-[11px]">
                <button
                  type="button"
                  onClick={() => onMatchModeChange("and")}
                  className={`px-2 py-0.5 rounded-md font-semibold transition ${
                    matchMode === "and"
                      ? "bg-accent text-black shadow"
                      : "text-muted hover:text-foreground"
                  }`}
                  title="Manga must have ALL selected included genres"
                >
                  Match All (AND)
                </button>
                <button
                  type="button"
                  onClick={() => onMatchModeChange("or")}
                  className={`px-2 py-0.5 rounded-md font-semibold transition ${
                    matchMode === "or"
                      ? "bg-accent text-black shadow"
                      : "text-muted hover:text-foreground"
                  }`}
                  title="Manga can have ANY of the selected included genres"
                >
                  Match Any (OR)
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search genres..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-ink border border-border rounded-lg text-xs text-foreground placeholder-muted focus:outline-none focus:border-accent"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Instruction Tip */}
            <p className="text-[10px] text-muted flex items-center gap-2">
              <span className="text-emerald-400 font-bold">+ Include</span>
              <span>&bull;</span>
              <span className="text-rose-400 font-bold">&minus; Exclude</span>
            </p>
          </div>

          {/* Genre Selection Grid */}
          <div className="max-h-64 overflow-y-auto py-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {filteredGenres.map((g) => {
              const isInc = included.includes(g);
              const isExc = excluded.includes(g);
              return (
                <div
                  key={g}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition ${
                    isInc
                      ? "bg-emerald-950/40 border-emerald-500/60 text-emerald-300 font-semibold"
                      : isExc
                      ? "bg-rose-950/40 border-rose-500/60 text-rose-300 line-through opacity-80"
                      : "bg-ink/60 border-border/60 text-foreground hover:border-border hover:bg-surfaceHover"
                  }`}
                >
                  <span className="truncate">{g}</span>
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <button
                      type="button"
                      onClick={() => toggleInclude(g)}
                      title={isInc ? "Remove inclusion" : "Include this genre"}
                      className={`w-5 h-5 rounded flex items-center justify-center font-bold text-xs transition ${
                        isInc
                          ? "bg-emerald-500 text-black shadow"
                          : "hover:bg-emerald-500/20 text-emerald-400"
                      }`}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleExclude(g)}
                      title={isExc ? "Remove exclusion" : "Exclude this genre"}
                      className={`w-5 h-5 rounded flex items-center justify-center font-bold text-xs transition ${
                        isExc
                          ? "bg-rose-500 text-white shadow"
                          : "hover:bg-rose-500/20 text-rose-400"
                      }`}
                    >
                      &minus;
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredGenres.length === 0 && (
              <p className="col-span-2 text-xs text-muted text-center py-4">
                No matching genres found.
              </p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-border flex items-center justify-between">
            <button
              type="button"
              onClick={clearAll}
              disabled={totalSelected === 0}
              className="text-xs text-muted hover:text-rose-400 disabled:opacity-30 disabled:pointer-events-none transition"
            >
              Reset Genres
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3.5 py-1.5 rounded-lg bg-accent text-black font-semibold text-xs hover:brightness-110 active:scale-95 transition shadow"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
