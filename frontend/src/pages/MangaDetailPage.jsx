import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import MangaGrid from "../components/MangaGrid";
import TrackingPanel from "../components/TrackingPanel";
import MangaMeter from "../components/MangaMeter";
import VibeChart from "../components/VibeChart";
import { getManga, getRecommendations, addFavorite, removeFavorite, listFavorites } from "../api/client";

import { useAuth } from "../context/useAuth";
import { useChatPageContext } from "../context/useChatPageContext";

function formatDescription(description) {
  return description
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function MangaDetailPage() {
  const { goldId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const { setPageManga } = useChatPageContext();

  const passedItem = location.state?.manga;
  const initialManga = passedItem
    ? {
        gold_id: passedItem.gold_id || goldId,
        title: passedItem.title,
        cover_image_url: passedItem.cover_url,
        description: passedItem.description,
        genres: passedItem.genres || [],
        rating_combined: passedItem.score,
        status_raw: passedItem.status,
        media_type: passedItem.type,
        authors: passedItem.authors || [],
        artists: passedItem.artists || [],
        official_links: passedItem.source_url
          ? { read: [], info: [{ url: passedItem.source_url, site: "Official" }] }
          : null,
      }
    : null;

  const [manga, setManga] = useState(initialManga);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(!initialManga);
  const [error, setError] = useState(null);
  const [coverFailed, setCoverFailed] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const favorited = Boolean(token) && isFavorited;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getManga(goldId).catch((err) => {
        if (initialManga) return initialManga;
        throw err;
      }),
      getRecommendations(goldId, 10).catch(() => ({ results: [] })),
    ])
      .then(([mangaData, recData]) => {
        if (cancelled) return;
        setManga(mangaData);
        setRecommendations(recData.results || []);
        setPageManga({ gold_id: mangaData.gold_id, title: mangaData.title });
        setError(null);
      })
      .catch(() => {
        if (!cancelled && !initialManga) {
          setError("Couldn't load this title. It may not exist, or the API is unreachable.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });


    return () => {
      cancelled = true;
      setPageManga(null);
    };
  }, [goldId, setPageManga]);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    listFavorites(token)
      .then((data) => {
        if (!cancelled) {
          setIsFavorited(data.favorites.some((f) => f.gold_id === goldId));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, goldId]);

  async function toggleFavorite() {
    if (!token) {
      navigate("/login");
      return;
    }
    setFavoriteBusy(true);
    try {
      if (favorited) {
        await removeFavorite(goldId, token);
        setIsFavorited(false);
      } else {
        await addFavorite(goldId, token);
        setIsFavorited(true);
      }
    } catch (err) {
      console.error("Favorite toggle failed:", err.response?.status, err.response?.data, err.message);
    } finally {
      setFavoriteBusy(false);
    }
  }

  if (loading) return <LoadingSpinner label="Loading title..." />;
  if (error) {
    return (
      <div className="space-y-4 py-8 max-w-xl">
        <ErrorMessage message={error} />
        <div>
          <Link
            to="/browse"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accentHover transition-colors"
          >
            ← Back to Browse
          </Link>
        </div>
      </div>
    );
  }
  if (!manga) return null;

  const scoreByGoldId = Object.fromEntries(
    recommendations.map((r) => [r.gold_id, r.similarity_score])
  );
  const description = manga.description ? formatDescription(manga.description) : "";

  return (
    <div className="space-y-8 animate-fadeIn pb-16">
      {/* Immersive AniList-style Banner Backdrop */}
      <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 -mt-6 sm:-mt-8 h-56 sm:h-72 md:h-84 overflow-hidden rounded-b-3xl border-b border-border bg-surface">
        {manga.cover_image_url && !coverFailed ? (
          <img
            src={manga.cover_image_url}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover scale-110 blur-2xl opacity-30 brightness-75 transition-all duration-700"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-accent/20 via-surface to-accent/10" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-transparent" />
      </div>

      {/* Main Content Container with Overlapping Hero */}
      <div className="relative -mt-28 sm:-mt-36 md:-mt-44 grid grid-cols-1 lg:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr] gap-8 items-start">
        {/* Left Column: Floating Artwork & Quick Sidebar Info */}
        <div className="space-y-5 lg:sticky lg:top-24">
          {/* Main Cover Card */}
          <div className="relative aspect-[2/3] w-56 sm:w-64 lg:w-full mx-auto rounded-3xl overflow-hidden bg-surface border-2 border-border/80 shadow-2xl group ring-1 ring-border/50">
            {manga.cover_image_url && !coverFailed ? (
              <img
                src={manga.cover_image_url}
                alt={manga.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={() => setCoverFailed(true)}
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-muted text-4xl">
                📖
              </div>
            )}
            {/* Format Pill Overlay */}
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md border border-white/10 text-white text-[10px] font-black tracking-wider uppercase shadow-lg">
              {manga.media_type || "MANGA"}
            </div>
            {/* Rating Star Badge */}
            {manga.rating_combined ? (
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 text-xs font-black shadow-lg flex items-center gap-1">
                <span>★</span>
                <span>{manga.rating_combined.toFixed(1)}</span>
              </div>
            ) : null}
          </div>

          {/* Quick Primary Action Buttons */}
          <div className="w-56 sm:w-64 lg:w-full mx-auto space-y-2.5">
            <button
              type="button"
              onClick={toggleFavorite}
              disabled={favoriteBusy}
              className={`w-full h-11 flex items-center justify-center gap-2 rounded-2xl border text-sm font-bold transition shadow-sm ${
                favorited
                  ? "border-rose-500 bg-rose-500/15 text-rose-400 hover:bg-rose-500/25"
                  : "border-border bg-surface text-foreground hover:bg-surfaceHover hover:border-accent"
              }`}
            >
              <span>{favorited ? "♥" : "♡"}</span>
              <span>{favorited ? "In Favorites" : "Add to Favorites"}</span>
            </button>
          </div>

          {/* Where to Read & Community Sources */}
          <div className="rounded-2xl border border-border bg-surface p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <span>📖</span>
                <span>Where to Read</span>
              </h3>
              <span className="text-[10px] text-muted font-bold">Online Readers</span>
            </div>

            <div className="flex flex-col gap-2">
              {/* Direct Reading Links from Official / Catalog */}
              {manga.official_links?.read?.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold px-3 py-2 rounded-xl bg-accentSoft text-accent border border-accent/20 hover:bg-accent hover:text-accentFg transition-all flex items-center justify-between group"
                >
                  <span className="flex items-center gap-1.5">
                    <span>⚡</span>
                    <span>Read on {link.site || "Platform"}</span>
                  </span>
                  <span className="text-[10px] opacity-70 group-hover:translate-x-0.5 transition-transform">↗</span>
                </a>
              ))}

              {/* Direct MangaDex Reader (if not already listed in official_links) */}
              {manga.source_urls?.mangadex && !manga.official_links?.read?.some((l) => l.url.includes("mangadex.org")) && (
                <a
                  href={manga.source_urls.mangadex}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold px-3 py-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500 hover:text-slate-950 transition-all flex items-center justify-between group"
                >
                  <span className="flex items-center gap-1.5">
                    <span>📙</span>
                    <span>Read on MangaDex</span>
                  </span>
                  <span className="text-[10px] opacity-70 group-hover:translate-x-0.5 transition-transform">↗</span>
                </a>
              )}

              {/* Quick Reader Search Actions */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <a
                  href={`https://mangadex.org/titles?q=${encodeURIComponent(manga.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-surfaceHover border border-border text-foreground hover:border-accent hover:text-accent transition-all text-center"
                >
                  MangaDex ↗
                </a>
                <a
                  href={`https://mangaplus.shueisha.co.jp/search_result?keyword=${encodeURIComponent(manga.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-surfaceHover border border-border text-foreground hover:border-accent hover:text-accent transition-all text-center"
                >
                  MangaPlus ↗
                </a>
                <a
                  href={`https://asuracomic.net/series?name=${encodeURIComponent(manga.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-surfaceHover border border-border text-foreground hover:border-accent hover:text-accent transition-all text-center"
                >
                  Asura Scans ↗
                </a>
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent("read " + manga.title + " manga online")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-surfaceHover border border-border text-foreground hover:border-accent hover:text-accent transition-all text-center"
                >
                  Google Reader ↗
                </a>
              </div>
            </div>

            {/* Official External Trackers & DB */}
            <div className="pt-2 border-t border-border/60">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted block mb-1.5">
                Database & Trackers
              </span>
              <div className="flex flex-wrap gap-1.5">
                {manga.source_urls?.anilist ? (
                  <a
                    href={manga.source_urls.anilist}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
                  >
                    AniList
                  </a>
                ) : (
                  <a
                    href={`https://anilist.co/search/manga?search=${encodeURIComponent(manga.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
                  >
                    AniList
                  </a>
                )}
                <a
                  href={`https://myanimelist.net/manga.php?q=${encodeURIComponent(manga.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold px-2 py-1 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20"
                >
                  MyAnimeList
                </a>
                {manga.source_urls?.mangaupdates ? (
                  <a
                    href={manga.source_urls.mangaupdates}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                  >
                    MangaUpdates
                  </a>
                ) : (
                  <a
                    href={`https://www.mangaupdates.com/series.html?search=${encodeURIComponent(manga.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                  >
                    MangaUpdates
                  </a>
                )}
              </div>
            </div>
          </div>


          {/* Metadata Fact Sheet Sidebar */}
          <div className="rounded-2xl border border-border bg-surface p-4 space-y-3 text-xs shadow-sm">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-muted pb-1 border-b border-border/60">
              Information
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted">Format:</span>
                <span className="font-bold text-foreground uppercase">{manga.media_type || "Manga"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Status:</span>
                <span className="font-bold text-foreground capitalize">{manga.status_raw || "Unknown"}</span>
              </div>
              {manga.year && (
                <div className="flex justify-between">
                  <span className="text-muted">Release Year:</span>
                  <span className="font-bold text-foreground">{manga.year}</span>
                </div>
              )}
              {manga.chapters != null && (
                <div className="flex justify-between">
                  <span className="text-muted">Total Chapters:</span>
                  <span className="font-bold text-foreground">{manga.chapters}</span>
                </div>
              )}
              {manga.volumes != null && (
                <div className="flex justify-between">
                  <span className="text-muted">Volumes:</span>
                  <span className="font-bold text-foreground">{manga.volumes}</span>
                </div>
              )}
              {manga.demographic && (
                <div className="flex justify-between">
                  <span className="text-muted">Demographic:</span>
                  <span className="font-bold text-accent capitalize">{manga.demographic}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted">Catalog Sources:</span>
                <span className="font-bold text-foreground">{manga.source_count} indexed</span>
              </div>
              {manga.authors?.length > 0 && (
                <div className="pt-2 border-t border-border/60">
                  <span className="text-muted block text-[10px] uppercase font-bold tracking-wider mb-0.5">Author</span>
                  <span className="font-bold text-foreground">{manga.authors.join(", ")}</span>
                </div>
              )}
              {manga.artists?.length > 0 && (
                <div className="pt-2 border-t border-border/60">
                  <span className="text-muted block text-[10px] uppercase font-bold tracking-wider mb-0.5">Artist</span>
                  <span className="font-bold text-foreground">{manga.artists.join(", ")}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Title, Synopsis, Meters, and Interactive Tracking */}
        <div className="space-y-6 min-w-0">
          {/* Title and Top Chips */}
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-foreground tracking-tight leading-tight">
              {manga.title}
            </h1>

            {/* Genre Chips */}
            {manga.genres && manga.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {manga.genres.slice(0, 14).map((g) => (
                  <span
                    key={g}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl bg-accentSoft text-accent border border-accent/20 transition hover:bg-accent hover:text-accentFg cursor-default"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Synopsis */}
          {description && (
            <div className="rounded-3xl bg-surface border border-border p-6 shadow-sm space-y-2">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted">
                Synopsis & Description
              </h2>
              <p className="text-foreground/90 leading-relaxed text-sm sm:text-base text-justify whitespace-pre-line [hyphens:auto]">
                {description}
              </p>
            </div>
          )}

          {/* Manga Meter & Vibe Radar */}
          <div className="space-y-6">
            <MangaMeter
              ratingCombined={manga.rating_combined}
              sources={
                manga.rating_combined_sources && manga.rating_combined_sources.length > 0
                  ? manga.rating_combined_sources
                  : manga.sources
              }
              ratingAnilist={manga.rating_anilist}
              ratingMangaupdates={manga.rating_mangaupdates}
            />

            <VibeChart genres={manga.genres} />
          </div>

          {/* Interactive Library Tracking Panel */}
          <div>
            <TrackingPanel goldId={goldId} token={token} />
          </div>
        </div>
      </div>

      {/* Bottom Section: Recommended For You */}
      <div className="pt-10 border-t border-border space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-foreground tracking-tight">
              Recommended For You
            </h2>
            <p className="text-xs sm:text-sm text-muted">
              Titles algorithmically similar based on themes, genres, and community engagement.
            </p>
          </div>
        </div>

        {recommendations.length > 0 ? (
          <MangaGrid
            items={recommendations}
            getSimilarity={(m) => scoreByGoldId[m.gold_id]}
          />
        ) : (
          <div className="rounded-3xl border border-border bg-surface p-8 text-center text-sm text-muted">
            No direct similarity recommendations available for this title yet.
          </div>
        )}
      </div>
    </div>
  );
}
