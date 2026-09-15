import { Link } from "react-router-dom";
import { useState } from "react";

const STATUS_LABELS = {
  reading: "Reading",
  completed: "Completed",
  planning: "Planning",
  paused: "Paused",
  dropped: "Dropped",
  rereading: "Re-reading",
};

const THEMES = [
  {
    gradient: "from-indigo-950 via-slate-900 to-slate-950",
    accent: "text-indigo-400",
    border: "border-indigo-500/30",
    pattern: "bg-[radial-gradient(#6366f1_1px,transparent_1px)]",
  },
  {
    gradient: "from-rose-950 via-slate-900 to-slate-950",
    accent: "text-rose-400",
    border: "border-rose-500/30",
    pattern: "bg-[radial-gradient(#f43f5e_1px,transparent_1px)]",
  },
  {
    gradient: "from-emerald-950 via-slate-900 to-slate-950",
    accent: "text-emerald-400",
    border: "border-emerald-500/30",
    pattern: "bg-[radial-gradient(#10b981_1px,transparent_1px)]",
  },
  {
    gradient: "from-amber-950 via-slate-900 to-slate-950",
    accent: "text-amber-400",
    border: "border-amber-500/30",
    pattern: "bg-[radial-gradient(#f59e0b_1px,transparent_1px)]",
  },
  {
    gradient: "from-sky-950 via-slate-900 to-slate-950",
    accent: "text-sky-400",
    border: "border-sky-500/30",
    pattern: "bg-[radial-gradient(#0ea5e9_1px,transparent_1px)]",
  },
  {
    gradient: "from-purple-950 via-slate-900 to-slate-950",
    accent: "text-purple-400",
    border: "border-purple-500/30",
    pattern: "bg-[radial-gradient(#a855f7_1px,transparent_1px)]",
  },
];

function getTheme(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return THEMES[Math.abs(hash) % THEMES.length];
}

export default function MangaCard({ manga, similarityScore, tracking, rank }) {
  const genres = (manga.genres || []).slice(0, 2);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const theme = getTheme(manga.title || manga.gold_id || "");

  const hasTotalChapters = manga.chapters != null && manga.chapters > 0;
  const progress = tracking ? tracking.progress ?? 0 : null;
  const progressPercent =
    tracking && hasTotalChapters
      ? Math.min(100, Math.max(0, Math.round((progress / manga.chapters) * 100)))
      : null;

  return (
    <Link
      to={`/manga/${encodeURIComponent(manga.gold_id)}`}
      className="group flex flex-col rounded-2xl bg-surface border border-border hover:border-accent hover:shadow-themeCard transition-all duration-300 relative overflow-hidden h-full"
    >
      {/* Cover Image Container */}
      <div className="aspect-[2/3] w-full bg-slate-950 overflow-hidden relative shrink-0">
        {manga.cover_image_url && !failed ? (
          <img
            src={manga.cover_image_url}
            alt={manga.title}
            referrerPolicy="no-referrer"
            loading="lazy"
            className={`h-full w-full object-cover group-hover:scale-105 transition-all duration-500 ease-out ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        ) : null}

        {/* Loading skeleton placeholder */}
        {!loaded && !failed && manga.cover_image_url && (
          <div className="absolute inset-0 bg-surfaceHover animate-pulse flex items-center justify-center">
            <span className="text-2xl opacity-30">📚</span>
          </div>
        )}

        {/* Fallback Editorial Manga Cover when image is missing or failed */}
        {(failed || !manga.cover_image_url) && (
          <div
            className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} flex flex-col justify-between p-3 sm:p-4 text-white select-none overflow-hidden`}
          >
            {/* Background subtle geometric pattern */}
            <div className={`absolute inset-0 ${theme.pattern} [background-size:12px_12px] opacity-20 pointer-events-none`} />

            {/* Top decorative header */}
            <div className="relative z-10 flex items-center justify-between border-b border-white/15 pb-1.5">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-black text-white/70">
                {manga.type || "Manga"}
              </span>
              <span className={`text-[10px] font-bold ${theme.accent}`}>
                {manga.year || "Vol. 1"}
              </span>
            </div>

            {/* Center title typography */}
            <div className="relative z-10 my-auto py-2 text-center px-1">
              <div className="w-5 h-0.5 mx-auto bg-white/20 mb-2 rounded-full" />
              <h4 className="font-extrabold text-xs sm:text-sm tracking-tight leading-tight line-clamp-3 text-white drop-shadow">
                {manga.title}
              </h4>
              <div className="w-5 h-0.5 mx-auto bg-white/20 mt-2 rounded-full" />
            </div>

            {/* Bottom details / barcode */}
            <div className="relative z-10 pt-1.5 border-t border-white/15 flex items-center justify-between text-[9px] text-white/60 font-mono">
              <span className="truncate max-w-[70px]">{genres[0] || "Featured"}</span>
              <span className="tracking-widest text-[8px] opacity-70">|||| || |||</span>
            </div>
          </div>
        )}

        {/* Optional Ranking Ribbon (Top Left) */}
        {rank != null && (
          <div
            className={`absolute top-2.5 left-2.5 z-20 px-2.5 py-0.5 rounded-lg text-xs font-black shadow-md flex items-center gap-1 ${
              rank === 1
                ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 ring-1 ring-white/50"
                : rank === 2
                ? "bg-gradient-to-r from-slate-200 to-slate-400 text-slate-950 ring-1 ring-white/50"
                : rank === 3
                ? "bg-gradient-to-r from-amber-600 to-amber-800 text-white ring-1 ring-white/30"
                : "bg-black/75 backdrop-blur-md text-white border border-white/10"
            }`}
          >
            {rank <= 3 && <span>🏆</span>}
            <span>#{rank}</span>
          </div>
        )}

        {/* Tracking Status Badge (Top Left if no rank) */}
        {tracking && rank == null && (
          <div className="absolute top-2.5 left-2.5 rounded-lg bg-black/80 backdrop-blur-md px-2 py-0.5 text-xs font-bold text-white shadow-md z-10 flex items-center gap-1.5 border border-white/15">
            <span
              className={`w-2 h-2 rounded-full ${
                tracking.status === "reading"
                  ? "bg-emerald-400 animate-pulse"
                  : tracking.status === "completed"
                  ? "bg-blue-400"
                  : tracking.status === "rereading"
                  ? "bg-purple-400"
                  : "bg-amber-400"
              }`}
            />
            <span className="capitalize">{STATUS_LABELS[tracking.status] || tracking.status}</span>
          </div>
        )}

        {/* Rating or Match Badge (Top Right) */}
        {typeof similarityScore === "number" ? (
          <div className="absolute top-2.5 right-2.5 rounded-lg bg-accent text-white px-2.5 py-0.5 text-xs font-extrabold shadow-md z-10 border border-white/20">
            {Math.round(similarityScore * 100)}% match
          </div>
        ) : manga.rating_combined != null ? (
          <div className="absolute top-2.5 right-2.5 rounded-lg bg-black/70 backdrop-blur-md text-emerald-400 px-2 py-0.5 text-xs font-extrabold shadow-md z-10 flex items-center gap-1 border border-white/10">
            <span className="text-amber-400 text-xs">★</span>
            <span>{typeof manga.rating_combined === "number" ? manga.rating_combined.toFixed(1) : manga.rating_combined}</span>
          </div>
        ) : null}

        {/* Format Badge (Bottom Left overlay) */}
        {manga.type && (
          <div className="absolute bottom-2 left-2 z-10">
            <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-extrabold uppercase tracking-wider text-white border border-white/10">
              {manga.type}
            </span>
          </div>
        )}

        {/* Tracking Progress Overlay (Bottom of cover) */}
        {tracking && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-3 pt-6 z-10">
            <div className="flex items-center justify-between text-xs font-bold text-white mb-1.5">
              <span>{hasTotalChapters ? `Ch. ${progress} / ${manga.chapters}` : `Ch. ${progress}`}</span>
              {progressPercent != null && <span className="text-accent font-extrabold">{progressPercent}%</span>}
            </div>
            {progressPercent != null && (
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card Info Content */}
      <div className="p-3 sm:p-3.5 flex flex-col flex-1 justify-between gap-2.5">
        <div>
          <h3 className="font-bold text-foreground text-xs sm:text-sm leading-snug line-clamp-2 min-h-[2.25rem] sm:min-h-[2.5rem] group-hover:text-accent transition-colors">
            {manga.title}
          </h3>

          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] sm:text-xs text-muted font-medium truncate">
            {manga.year && <span>{manga.year}</span>}
            {manga.year && <span>•</span>}
            <span>{manga.chapters ? `${manga.chapters} Chs` : "Ongoing"}</span>
            {manga.source_count > 1 && (
              <>
                <span>•</span>
                <span>{manga.source_count} srcs</span>
              </>
            )}
          </div>
        </div>

        {/* Genre Tags */}
        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {genres.map((g) => (
              <span
                key={g}
                className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md bg-surfaceHover text-muted font-semibold group-hover:border-accent/30 transition-colors"
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
