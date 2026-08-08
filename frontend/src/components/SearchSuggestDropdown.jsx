import { Link } from "react-router-dom";

export default function SearchSuggestDropdown({ results, query, onSelect, onViewAll }) {
  if (!results || results.length === 0) return null;

  return (
    <div className="absolute top-full left-0 right-0 mt-2 rounded-xl bg-surface border border-border
                    shadow-2xl overflow-hidden z-30">
      <p className="filter-label px-4 pt-3 pb-2">Results</p>

      <div className="max-h-96 overflow-y-auto">
        {results.map((manga) => (
          <Link
            key={manga.gold_id}
            to={`/manga/${encodeURIComponent(manga.gold_id)}`}
            onClick={onSelect}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-surfaceHover transition"
          >
            <div className="h-12 w-9 rounded bg-ink overflow-hidden shrink-0">
              {manga.cover_image_url ? (
                <img
                  src={manga.cover_image_url}
                  alt={manga.title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{manga.title}</p>
              <div className="flex items-center gap-2 text-xs text-white/40">
                {manga.year && <span>{manga.year}</span>}
                {manga.rating_combined && (
                  <>
                    <span>·</span>
                    <span className="text-accent">★ {manga.rating_combined.toFixed(1)}</span>
                  </>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <button
        onClick={onViewAll}
        className="w-full text-left px-4 py-3 text-sm text-accent hover:bg-surfaceHover
                   border-t border-border transition flex items-center justify-between"
      >
        <span>View all results for "{query}"</span>
        <span>→</span>
      </button>
    </div>
  );
}
