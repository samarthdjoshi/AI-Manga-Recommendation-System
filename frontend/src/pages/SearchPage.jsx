import { useState, useEffect, useTransition } from "react";
import { useSearchParams, Link } from "react-router-dom";
import MangaCard from "../components/MangaCard";
import LoadingSpinner from "../components/LoadingSpinner";
import { browseManga } from "../api/client";

const FORMAT_OPTIONS = ["All", "Manga", "Manhwa", "Manhua"];
const STATUS_OPTIONS = ["All", "Releasing", "Completed"];

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [selectedFormat, setSelectedFormat] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [results, setResults] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("manga_recent_searches")) || [
        "Solo Leveling",
        "Berserk",
        "Chainsaw Man",
        "One Piece",
      ];
    } catch {
      return ["Solo Leveling", "Berserk", "Chainsaw Man", "One Piece"];
    }
  });

  const qParam = searchParams.get("q") || "";
  const [prevQParam, setPrevQParam] = useState(qParam);
  if (qParam !== prevQParam) {
    setPrevQParam(qParam);
    setQuery(qParam);
  }

  useEffect(() => {
    let cancelled = false;
    const trimmed = query.trim();

    if (!trimmed) {
      return;
    }

    const debounceTimer = setTimeout(() => {
      setLoading(true);
      const params = {
        q: trimmed,
        limit: 24,
        offset: 0,
      };

      if (selectedFormat !== "All") {
        params.type = selectedFormat.toLowerCase();
      }
      if (selectedStatus !== "All") {
        params.status = selectedStatus.toLowerCase();
      }

      browseManga(params)
        .then((data) => {
          if (!cancelled) {
            startTransition(() => {
              setResults(data.results || []);
              setTotalCount(data.total || 0);
              setLoading(false);
            });
          }
        })
        .catch(() => {
          if (!cancelled) {
            setResults([]);
            setLoading(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(debounceTimer);
    };
  }, [query, selectedFormat, selectedStatus]);

  const displayResults = query.trim() ? results : [];
  const displayCount = query.trim() ? totalCount : 0;

  function handleSearchSubmit(e) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setSearchParams({ q: trimmed });
    const updated = [trimmed, ...recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
    setRecentSearches(updated);
    try {
      localStorage.setItem("manga_recent_searches", JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  function handleSelectRecent(term) {
    setQuery(term);
    setSearchParams({ q: term });
  }

  function handleClear() {
    setQuery("");
    setSearchParams({});
    setResults([]);
  }

  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto">
      {/* Header & Search Bar */}
      <div className="border-b border-border pb-6 space-y-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold mb-2">
            <span>🔍</span>
            <span>Global Manga Search</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            Search Manga, Manhwa & Light Novels
          </h1>
          <p className="text-sm text-muted mt-1">
            Fast vector-indexed search across 339,941 verified catalog titles.
          </p>
        </div>

        {/* Input form */}
        <form onSubmit={handleSearchSubmit} className="relative max-w-2xl">
          <div className="relative flex items-center">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, romaji, author, or keywords..."
              autoFocus
              className="w-full h-12 rounded-2xl bg-surface border border-border pl-12 pr-24 text-sm text-foreground placeholder-muted focus:outline-none focus:border-accent shadow-sm"
            />
            <svg
              className="absolute left-4 w-5 h-5 text-muted pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <div className="absolute right-3 flex items-center gap-1.5">
              {query && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1 rounded-lg hover:bg-surfaceHover text-muted hover:text-foreground text-xs"
                >
                  ✕
                </button>
              )}
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-accent text-accentFg text-xs font-bold hover:bg-accentHover transition"
              >
                Search
              </button>
            </div>
          </div>
        </form>

        {/* Recent Search Chips */}
        {recentSearches.length > 0 && !query && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-muted font-semibold">Recent searches:</span>
            {recentSearches.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => handleSelectRecent(term)}
                className="px-2.5 py-1 rounded-lg bg-surface border border-border text-foreground hover:border-accent hover:text-accent transition text-xs font-medium"
              >
                {term}
              </button>
            ))}
          </div>
        )}

        {/* Filter Row */}
        <div className="flex flex-wrap items-center gap-4 pt-2">
          {/* Format Chips */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted font-semibold">Format:</span>
            {FORMAT_OPTIONS.map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setSelectedFormat(fmt)}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  selectedFormat === fmt
                    ? "bg-accent text-accentFg shadow-sm"
                    : "bg-surface border border-border text-muted hover:text-foreground"
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>

          {/* Status Chips */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted font-semibold">Status:</span>
            {STATUS_OPTIONS.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  selectedStatus === st
                    ? "bg-accent text-accentFg shadow-sm"
                    : "bg-surface border border-border text-muted hover:text-foreground"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Section */}
      {loading ? (
        <div className="py-24">
          <LoadingSpinner />
        </div>
      ) : query && displayResults.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-surface/40 space-y-3">
          <div className="text-4xl">🔎</div>
          <h3 className="text-base font-bold text-foreground">No matches found for "{query}"</h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            Try checking for typos, searching by alternative Japanese romaji, or browsing our full catalog.
          </p>
          <Link
            to="/browse"
            className="inline-block px-4 py-2 rounded-xl bg-accent text-accentFg text-xs font-bold hover:bg-accentHover transition mt-2"
          >
            Explore Advanced Catalog Browse &rarr;
          </Link>
        </div>
      ) : query && displayResults.length > 0 ? (
        <div className="space-y-4">
          <div className="text-xs text-muted">
            Found <strong className="text-foreground">{displayCount}</strong> results for "{query}"
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {displayResults.map((manga) => (
              <MangaCard key={manga.gold_id} manga={manga} />
            ))}
          </div>
        </div>
      ) : (
        /* Empty Query Showcase */
        <div className="rounded-2xl border border-border bg-surface p-8 text-center space-y-4">
          <p className="text-sm text-muted">
            Start typing above to search across 339,941 titles or jump into curated leaderboards:
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/trending"
              className="px-4 py-2 rounded-xl bg-surfaceHover border border-border text-xs font-bold text-foreground hover:border-accent hover:text-accent transition"
            >
              🔥 Real-time Trending
            </Link>
            <Link
              to="/top-100"
              className="px-4 py-2 rounded-xl bg-surfaceHover border border-border text-xs font-bold text-foreground hover:border-accent hover:text-accent transition"
            >
              🏆 Top 100 Leaderboard
            </Link>
            <Link
              to="/manhwa"
              className="px-4 py-2 rounded-xl bg-surfaceHover border border-border text-xs font-bold text-foreground hover:border-accent hover:text-accent transition"
            >
              🇰🇷 Popular Manhwa
            </Link>
            <Link
              to="/browse"
              className="px-4 py-2 rounded-xl bg-surfaceHover border border-border text-xs font-bold text-foreground hover:border-accent hover:text-accent transition"
            >
              🎯 Advanced Multi-Filter
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
