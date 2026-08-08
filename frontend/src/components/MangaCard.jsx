import { Link } from "react-router-dom";
import { useState } from "react";

export default function MangaCard({ manga, similarityScore }) {
  const genres = (manga.genres || []).slice(0, 2);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <Link
      to={`/manga/${encodeURIComponent(manga.gold_id)}`}
      className="group block rounded-xl bg-surface border border-border overflow-hidden
                 hover:border-accent/50 hover:bg-surfaceHover transition"
    >
      <div className="aspect-[2/3] bg-ink overflow-hidden relative">
        {manga.cover_image_url && !failed ? (
          <img
            src={manga.cover_image_url}
            alt={manga.title}
            referrerPolicy="no-referrer"
            loading="eager"
            className={`h-full w-full object-cover group-hover:scale-105 transition-all duration-300
                       ${loaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        ) : null}

        {(!loaded || failed) && (
          <div className={`absolute inset-0 flex items-center justify-center
                          ${failed ? "text-white/15" : "bg-surfaceHover animate-pulse"}`}>
            {failed && (
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M18 10.5h.008v.008H18V10.5zM3.75 21h16.5a1.5 1.5 0 001.5-1.5V4.5A1.5 1.5 0 0020.25 3H3.75A1.5 1.5 0 002.25 4.5v15A1.5 1.5 0 003.75 21z" />
              </svg>
            )}
          </div>
        )}

        {typeof similarityScore === "number" && (
          <div className="absolute top-2 right-2 rounded-md bg-accent/90 backdrop-blur px-2 py-0.5 text-[11px] font-bold text-white z-10">
            {Math.round(similarityScore * 100)}%
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="font-semibold text-white text-sm leading-snug line-clamp-2 group-hover:text-accent transition">
          {manga.title}
        </h3>

        <div className="flex items-center gap-2 mt-1.5 text-xs text-white/40">
          {manga.year && <span>{manga.year}</span>}
          <span>·</span>
          <span>{manga.source_count} source{manga.source_count !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span>{manga.chapters ? `Ch. ${manga.chapters}` : "Chapters unknown"}</span>
        </div>

        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {genres.map((g) => (
              <span
                key={g}
                className="text-[10px] px-1.5 py-0.5 rounded bg-accentSoft text-accent/90 font-medium"
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

