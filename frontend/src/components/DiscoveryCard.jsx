import { useState } from "react";
import { Link } from "react-router-dom";

export default function DiscoveryCard({ item, rank }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Determine navigation link: preference for gold_id, fallback to search if not local ID
  const targetLink = item.gold_id
    ? `/manga/${encodeURIComponent(item.gold_id)}`
    : `/browse?q=${encodeURIComponent(item.title)}`;

  const genres = (item.genres || []).slice(0, 2);
  const displayRank = rank ?? item.rank;

  return (
    <Link
      to={targetLink}
      state={{ manga: item }}
      className="group flex-shrink-0 w-[185px] sm:w-[215px] md:w-[230px] flex flex-col rounded-2xl bg-surface border border-border overflow-hidden hover:border-accent hover:shadow-themeCard transition-all duration-300 relative"
    >
      {/* Cover Artwork Container */}
      <div className="aspect-[2/3] w-full bg-ink overflow-hidden relative shrink-0">
        {item.cover_url && !failed ? (
          <img
            src={item.cover_url}
            alt={item.title}
            referrerPolicy="no-referrer"
            loading="lazy"
            className={`h-full w-full object-cover group-hover:scale-105 transition-all duration-500 ease-out ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        ) : null}

        {/* Loading / Fallback Placeholder */}
        {(!loaded || failed) && (
          <div
            className={`absolute inset-0 flex items-center justify-center ${
              failed ? "text-muted" : "bg-surfaceHover animate-pulse"
            }`}
          >
            <div className="flex flex-col items-center gap-1.5 text-muted p-4 text-center">
              <span className="text-3xl">📖</span>
              <span className="text-xs font-semibold line-clamp-2">{item.title}</span>
            </div>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10 pointer-events-none">
          {displayRank != null ? (
            <span
              className={`text-xs font-black px-2.5 py-0.5 rounded-lg shadow-md backdrop-blur-md flex items-center gap-1 ${
                displayRank === 1
                  ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 ring-1 ring-white/50"
                  : displayRank === 2
                  ? "bg-gradient-to-r from-slate-200 to-slate-400 text-slate-950 ring-1 ring-white/50"
                  : displayRank === 3
                  ? "bg-gradient-to-r from-amber-600 to-amber-800 text-white ring-1 ring-white/30"
                  : "bg-black/75 text-white border border-white/10"
              }`}
            >
              {displayRank <= 3 && <span>🏆</span>}
              <span>#{displayRank}</span>
            </span>
          ) : <span />}

          {item.score != null && (
            <span className="text-xs font-extrabold px-2 py-0.5 rounded-lg bg-black/70 text-emerald-400 backdrop-blur-md flex items-center gap-1 shadow-md border border-white/10">
              <span className="text-amber-400 text-xs">★</span>
              <span>{typeof item.score === "number" ? item.score.toFixed(1) : item.score}</span>
            </span>
          )}
        </div>

        {/* Format Pill (e.g. MANHWA / NOVEL) */}
        {item.type && (
          <div className="absolute bottom-2.5 left-2.5 z-10">
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-white border border-white/10 shadow-sm">
              {item.type}
            </span>
          </div>
        )}
      </div>

      {/* Content Details */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-2.5">
        <div>
          <h3
            className="font-bold text-foreground text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-accent transition-colors"
            title={item.title}
          >
            {item.title}
          </h3>
        </div>

        {/* Genre Chips */}
        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {genres.map((g) => (
              <span
                key={g}
                className="text-xs px-2.5 py-0.5 rounded-lg bg-surfaceHover text-muted font-semibold group-hover:border-accent/30 transition-colors"
              >
                {g}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
