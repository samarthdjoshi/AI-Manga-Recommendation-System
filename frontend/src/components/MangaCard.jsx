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

export default function MangaCard({ manga, similarityScore, tracking, rank }) {
  const genres = (manga.genres || []).slice(0, 2);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

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
      <div className="aspect-[2/3] w-full bg-ink overflow-hidden relative shrink-0">
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

        {(!loaded || failed) && (
          <div
            className={`absolute inset-0 flex items-center justify-center ${
              failed ? "text-muted" : "bg-surfaceHover animate-pulse"
            }`}
          >
            {failed ? (
              <div className="flex flex-col items-center gap-1.5 text-muted p-4 text-center">
                <span className="text-3xl">📖</span>
                <span className="text-xs font-semibold line-clamp-2">{manga.title}</span>
              </div>
            ) : null}
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
      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div>
          <h3 className="font-bold text-foreground text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-accent transition-colors">
            {manga.title}
          </h3>

          <div className="flex items-center gap-2 mt-2 text-xs text-muted font-medium">
            {manga.year && <span>{manga.year}</span>}
            {manga.year && <span>•</span>}
            <span>{manga.chapters ? `${manga.chapters} Chs` : "Ongoing"}</span>
            {manga.source_count > 1 && (
              <>
                <span>•</span>
                <span>{manga.source_count} sources</span>
              </>
            )}
          </div>
        </div>

        {/* Genre Tags */}
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
