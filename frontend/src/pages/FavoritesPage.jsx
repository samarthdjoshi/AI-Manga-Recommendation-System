import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import MangaGrid from "../components/MangaGrid";
import { listFavorites, getManga, getRecommendationsForMe } from "../api/client";
import { useAuth } from "../context/useAuth";

export default function FavoritesPage() {
  const { token, loading: authLoading } = useAuth();

  const [manga, setManga] = useState([]);
  const [loading, setLoading] = useState(() => Boolean(token));
  const [error, setError] = useState(null);
  const [forYou, setForYou] = useState([]);

  useEffect(() => {
    if (authLoading) return;

    if (!token) return undefined;

    let cancelled = false;
    listFavorites(token)
      .then((data) => {
        const goldIds = data.favorites.map((f) => f.gold_id);
        return Promise.all(
          goldIds.map((id) => getManga(id).catch(() => null))
        );
      })
      .then((results) => {
        if (cancelled) return;
        setManga(results.filter(Boolean));
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your favorites. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, authLoading]);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    getRecommendationsForMe(token, 10)
      .then((data) => {
        if (!cancelled) setForYou(data.results || []);
      })
      .catch(() => {
        if (!cancelled) setForYou([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (authLoading || loading) return <LoadingSpinner label="Loading your favorites..." />;

  if (!token) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <h1 className="text-2xl font-extrabold text-foreground mb-2">My Favorites</h1>
        <p className="text-muted text-sm mb-6">Sign in to view your favorited manga and get personalized recommendations.</p>
        <Link
          to="/login"
          className="inline-block rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-accentFg hover:bg-accentHover transition shadow-sm"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-8 pb-16">
      <div className="border-b border-border pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">My Favorites</h1>
          <p className="text-xs text-muted mt-1">Titles you've saved to your private collection.</p>
        </div>
        <Link
          to="/profile"
          className="text-xs font-bold text-accent hover:underline"
        >
          View Full Library & Stats →
        </Link>
      </div>

      {manga.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-surface/50">
          <p className="text-sm text-muted">
            You have not favorited anything yet. Browse titles and tap the heart icon to save them here.
          </p>
          <Link
            to="/browse"
            className="mt-4 inline-block px-4 py-2 rounded-xl bg-accent text-accentFg text-xs font-bold hover:bg-accentHover transition-colors shadow-sm"
          >
            Browse Titles
          </Link>
        </div>
      ) : (
        <MangaGrid items={manga} />
      )}

      {forYou.length > 0 && (
        <div className="mt-14 pt-8 border-t border-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-foreground">Recommended For You</h2>
              <p className="text-xs text-muted">Content-based and collaborative similarity based on your saved favorites.</p>
            </div>
          </div>
          <MangaGrid items={forYou} getSimilarity={(m) => m.similarity_score} />
        </div>
      )}
    </div>
  );
}
