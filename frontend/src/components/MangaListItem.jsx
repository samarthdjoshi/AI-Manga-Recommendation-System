import { useState } from "react";
import { Link } from "react-router-dom";

export default function MangaListItem({ manga }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="group rounded-2xl bg-surface border border-border p-3.5 hover:border-accent/60 hover:shadow-themeCard transition-all duration-200 flex gap-4 items-start">
      {/* Cover Artwork */}
      <Link
        to={`/manga/${encodeURIComponent(manga.gold_id)}`}
        className="w-16 sm:w-20 aspect-[2/3] rounded-xl overflow-hidden bg-ink border border-border/40 shrink-0 relative block group-hover:scale-105 transition-transform"
      >
        <div className="absolute inset-0 flex items-center justify-center text-muted text-xs select-none">
          📖
        </div>
        {manga.cover_image_url && !imgFailed && (
          <img
            src={manga.cover_image_url}
            alt={manga.title}
            referrerPolicy="no-referrer"
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        )}
      </Link>

      {/* Main Metadata */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            to={`/manga/${encodeURIComponent(manga.gold_id)}`}
            className="font-bold text-sm sm:text-base text-foreground group-hover:text-accent transition truncate max-w-[80%]"
          >
            {manga.title}
          </Link>
          {manga.rating_combined != null && (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20 shrink-0">
              ★ {manga.rating_combined.toFixed(1)}
            </span>
          )}
        </div>

        {/* Secondary Info Badges */}
        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted">
          {manga.year && <span>{manga.year}</span>}
          {manga.status_raw && (
            <>
              <span>&bull;</span>
              <span className="capitalize">{manga.status_raw}</span>
            </>
          )}
          {manga.chapters != null && (
            <>
              <span>&bull;</span>
              <span>{manga.chapters} ch</span>
            </>
          )}
          {manga.source_count != null && (
            <>
              <span>&bull;</span>
              <span className="text-[11px] font-medium text-muted/80">
                {manga.source_count} {manga.source_count === 1 ? "source" : "sources"}
              </span>
            </>
          )}
        </div>

        {/* Genre Tags */}
        {manga.genres && manga.genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {manga.genres.slice(0, 5).map((g) => (
              <span
                key={g}
                className="text-[10px] px-2 py-0.5 rounded-md bg-ink border border-border/60 text-muted font-medium"
              >
                {g}
              </span>
            ))}
            {manga.genres.length > 5 && (
              <span className="text-[10px] text-muted/60 self-center">
                +{manga.genres.length - 5}
              </span>
            )}
          </div>
        )}

        {/* Description snippet */}
        {manga.description && (
          <p className="mt-2 text-xs text-muted/80 line-clamp-2 leading-relaxed">
            {manga.description}
          </p>
        )}
      </div>
    </div>
  );
}
