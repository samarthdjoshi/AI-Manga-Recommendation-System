import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import MangaGrid from "../components/MangaGrid";
import LoadingSpinner from "../components/LoadingSpinner";
import { getDiscover } from "../api/client";

export default function HomePage() {
  const navigate = useNavigate();
  const [popular, setPopular] = useState([]);
  const [corroborated, setCorroborated] = useState([]);
  const [loading, setLoading] = useState(true);

  function handleSearch(query) {
    if (query && query.trim()) {
      navigate(`/browse?q=${encodeURIComponent(query.trim())}`);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([getDiscover("rating", 10), getDiscover("corroborated", 10)])
      .then(([ratingData, corroboratedData]) => {
        if (cancelled) return;
        setPopular(ratingData.results || []);
        setCorroborated(corroboratedData.results || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="flex flex-col items-center text-center pt-10 pb-16">
        <div className="rounded-full bg-accentSoft text-accent text-xs font-semibold px-3 py-1 mb-6">
          339,941 titles · 3 sources merged
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight max-w-2xl leading-tight">
          Find your next manga,
          <br />
          <span className="text-accent">manhwa, or manhua</span>
        </h1>

        <p className="text-white/50 mt-5 max-w-lg">
          Content-based recommendations built on real semantic embeddings and
          merged data from AniList, MangaDex, and MangaUpdates.
        </p>

        <div className="w-full max-w-xl mt-10">
          <SearchBar onSearch={handleSearch} />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
          {["Chainsaw Man", "One Piece", "Death Note", "Vagabond"].map((example) => (
            <button
              key={example}
              onClick={() => handleSearch(example)}
              className="text-xs rounded-full border border-border px-3 py-1.5 text-white/50
                         hover:text-white hover:border-accent/50 transition"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading discovery rails..." />
      ) : (
        <div className="space-y-14 pb-16">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="filter-label">Most Popular</h2>
              <span className="text-xs text-white/30">by combined rating</span>
            </div>
            <MangaGrid items={popular} />
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="filter-label">Fully Corroborated</h2>
              <span className="text-xs text-white/30">confirmed across all 3 sources</span>
            </div>
            <MangaGrid items={corroborated} />
          </section>
        </div>
      )}
    </div>
  );
}
