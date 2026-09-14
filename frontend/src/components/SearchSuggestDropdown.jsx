import { Link } from "react-router-dom";

export default function SearchSuggestDropdown({
  results = [],
  query = "",
  onSelect,
  onViewAll,
  dropdownAlign = "left",
  selectedIndex = -1,
}) {
  const hasResults = results && results.length > 0;
  const isTrimmedQuery = Boolean(query && query.trim());

  if (!hasResults && !isTrimmedQuery) return null;

  // Alignment classes: if dropdownAlign is 'right', anchor to right edge so it never overflows offscreen
  const alignClass =
    dropdownAlign === "right"
      ? "right-0 left-auto w-[360px] sm:w-[440px] max-w-[calc(100vw-1.5rem)]"
      : "left-0 right-auto w-full min-w-[320px] sm:min-w-[420px] max-w-[calc(100vw-1.5rem)]";

  return (
    <div
      className={`absolute top-full mt-2 rounded-2xl bg-surface border border-border
                  shadow-2xl ring-1 ring-border/80 overflow-hidden z-50 animate-fadeIn ${alignClass}`}
    >
      {/* Header Bar */}
      <div className="px-4 py-2.5 bg-surfaceHover/50 border-b border-border/70 flex items-center justify-between">
        <span className="text-[11px] font-black uppercase tracking-wider text-muted">
          Quick Matches
        </span>
        {hasResults && (
          <span className="text-[11px] font-semibold text-muted">
            {results.length} suggested
          </span>
        )}
      </div>

      {/* Results List or Empty State */}
      <div className="max-h-[380px] overflow-y-auto divide-y divide-border/40 scrollbar-thin">
        {hasResults ? (
          results.map((manga, idx) => {
            const isHighlighted = idx === selectedIndex;
            const genres = (manga.genres || []).slice(0, 2);

            return (
              <Link
                key={manga.gold_id || idx}
                to={`/manga/${encodeURIComponent(manga.gold_id)}`}
                onClick={onSelect}
                className={`flex items-center gap-3.5 px-4 py-3 transition-colors group cursor-pointer ${
                  isHighlighted
                    ? "bg-accentSoft/70 ring-1 ring-accent/30"
                    : "hover:bg-surfaceHover/80"
                }`}
              >
                {/* Poster Thumbnail */}
                <div className="h-14 w-10 rounded-lg bg-ink border border-border/70 overflow-hidden shrink-0 flex items-center justify-center text-muted relative shadow-sm">
                  <span className="text-xs select-none">📖</span>
                  {manga.cover_image_url ? (
                    <img
                      src={manga.cover_image_url}
                      alt={manga.title}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : null}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground group-hover:text-accent transition-colors truncate">
                    {manga.title}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted mt-1 truncate">
                    {manga.type && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-accent/15 text-accent border border-accent/20 shrink-0">
                        {manga.type}
                      </span>
                    )}
                    {manga.year && (
                      <span className="font-semibold text-muted shrink-0">
                        {manga.year}
                      </span>
                    )}
                    {genres.length > 0 && (
                      <span className="truncate text-muted">
                        {manga.year ? "• " : ""}
                        {genres.join(", ")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Rating Badge */}
                {manga.rating_combined != null && manga.rating_combined > 0 && (
                  <div className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-black shadow-xs">
                    <span className="text-amber-400 text-xs">★</span>
                    <span>{manga.rating_combined.toFixed(1)}</span>
                  </div>
                )}
              </Link>
            );
          })
        ) : (
          <div className="p-6 text-center space-y-1.5">
            <p className="text-xs font-bold text-foreground">
              No direct suggestions for "{query}"
            </p>
            <p className="text-[11px] text-muted">
              Press Enter or click below to search our full catalog of 339,000+ titles.
            </p>
          </div>
        )}
      </div>

      {/* Footer "View all results" Action */}
      <button
        type="button"
        onClick={onViewAll}
        className="w-full text-left px-4 py-3 bg-surfaceHover/40 hover:bg-accentSoft hover:text-accent
                   border-t border-border transition-colors flex items-center justify-between text-xs font-bold text-accent"
      >
        <div className="flex items-center gap-2 truncate">
          <span>🔍</span>
          <span className="truncate">View all results for "{query}"</span>
        </div>
        <span className="font-black text-sm shrink-0 ml-2">&rarr;</span>
      </button>
    </div>
  );
}
