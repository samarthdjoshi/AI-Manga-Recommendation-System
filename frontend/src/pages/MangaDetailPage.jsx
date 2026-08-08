import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import MangaGrid from "../components/MangaGrid";
import { getManga, getRecommendations } from "../api/client";

export default function MangaDetailPage() {
  const { goldId } = useParams();

  const [manga, setManga] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [coverFailed, setCoverFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setManga(null);
    setRecommendations([]);
    setCoverFailed(false);

    Promise.all([getManga(goldId), getRecommendations(goldId, 10)])
      .then(([mangaData, recData]) => {
        if (cancelled) return;
        setManga(mangaData);
        setRecommendations(recData.results || []);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this title. It may not exist, or the API is unreachable.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [goldId]);

  if (loading) return <LoadingSpinner label="Loading title..." />;
  if (error) return <ErrorMessage message={error} />;
  if (!manga) return null;

  const scoreByGoldId = Object.fromEntries(
    recommendations.map((r) => [r.gold_id, r.similarity_score])
  );

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
        <div className="rounded-xl overflow-hidden bg-surface border border-border aspect-[2/3] h-fit">
          {manga.cover_image_url && !coverFailed ? (
            <img
              src={manga.cover_image_url}
              alt={manga.title}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
              onError={() => setCoverFailed(true)}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-white/15">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M18 10.5h.008v.008H18V10.5zM3.75 21h16.5a1.5 1.5 0 001.5-1.5V4.5A1.5 1.5 0 0020.25 3H3.75A1.5 1.5 0 002.25 4.5v15A1.5 1.5 0 003.75 21z" />
              </svg>
            </div>
          )}
        </div>

        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            {manga.title}
          </h1>

          <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-white/50">
            {manga.year && <span>{manga.year}</span>}
            {manga.status_raw && (
              <>
                <span>·</span>
                <span className="capitalize">{manga.status_raw}</span>
              </>
            )}
            {manga.rating_combined && (
              <>
                <span>·</span>
                <span className="text-accent font-semibold">
                  ★ {manga.rating_combined.toFixed(2)}
                </span>
              </>
            )}
            <span>·</span>
            <span>{manga.source_count} source{manga.source_count !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span>{manga.chapters ? `Ch. ${manga.chapters}` : "Chapters unknown"}</span>
          </div>

          {manga.genres && manga.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {manga.genres.slice(0, 12).map((g) => (
                <span
                  key={g}
                  className="text-xs px-2 py-1 rounded-md bg-accentSoft text-accent/90 font-medium"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {manga.description && (
            <p
              className="text-white/60 leading-relaxed mt-5 max-w-2xl"
              dangerouslySetInnerHTML={{ __html: manga.description.replace(/\n/g, "<br/>") }}
            />
          )}
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="mt-14">
          <h2 className="filter-label mb-4">Recommended For You</h2>
          <MangaGrid
            items={recommendations}
            getSimilarity={(m) => scoreByGoldId[m.gold_id]}
          />
        </div>
      )}
    </div>
  );
}

