import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import MangaCard from "../components/MangaCard";
import LoadingSpinner from "../components/LoadingSpinner";
import { getRecommendationsForMe } from "../api/client";
import { useAuth } from "../context/useAuth";

const GENRES = [
  "All Genres",
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Horror",
  "Isekai",
  "Martial Arts",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Supernatural",
  "Thriller",
];

const ITEMS_PER_PAGE = 24;

export default function RecommendationsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user } = useAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filter & Search states
  const [selectedType, setSelectedType] = useState("all");
  const [selectedGenre, setSelectedGenre] = useState("All Genres");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("match"); // "match", "rating", "alphabetical"
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  function fetchRecs(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    // Request 80 recommendations from the API (guaranteeing >= 60 results)
    getRecommendationsForMe(token, 80)
      .then((res) => {
        setItems(res.results || []);
        setLoading(false);
        setRefreshing(false);
      })
      .catch(() => {
        setError("Failed to fetch recommendations. Please try again.");
        setLoading(false);
        setRefreshing(false);
      });
  }

  useEffect(() => {
    fetchRecs();
  }, [token]);

  function handleBack() {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(user ? "/library" : "/");
    }
  }

  // Filter & Sort computation
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Filter by type
    if (selectedType !== "all") {
      result = result.filter((item) => {
        const itemType = (item.type || "").toLowerCase();
        const goldId = (item.gold_id || "").toLowerCase();
        const genres = (item.genres || []).map((g) => g.toLowerCase());

        if (selectedType === "manhwa") {
          return (
            itemType === "manhwa" ||
            genres.includes("manhwa") ||
            genres.includes("korean")
          );
        }
        if (selectedType === "manhua") {
          return (
            itemType === "manhua" ||
            genres.includes("manhua") ||
            genres.includes("chinese")
          );
        }
        if (selectedType === "manga") {
          return (
            itemType === "manga" ||
            (!genres.includes("manhwa") && !genres.includes("manhua"))
          );
        }
        return true;
      });
    }

    // Filter by genre
    if (selectedGenre !== "All Genres") {
      const gLower = selectedGenre.toLowerCase();
      result = result.filter((item) =>
        (item.genres || []).some((g) => g.toLowerCase() === gLower)
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.original_title?.toLowerCase().includes(q) ||
          (item.genres || []).some((g) => g.toLowerCase().includes(q))
      );
    }

    // Sort
    if (sortBy === "match") {
      result.sort((a, b) => (b.similarity_score || 0) - (a.similarity_score || 0));
    } else if (sortBy === "rating") {
      result.sort((a, b) => (b.rating_combined || 0) - (a.rating_combined || 0));
    } else if (sortBy === "alphabetical") {
      result.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }

    return result;
  }, [items, selectedType, selectedGenre, searchQuery, sortBy]);

  const pagedItems = filteredItems.slice(0, visibleCount);
  const hasMore = visibleCount < filteredItems.length;

  return (
    <div className="space-y-8 pb-16">
      {/* Top Navigation & Header */}
      <div className="flex flex-col gap-4 border-b border-border pb-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surface border border-border text-xs font-bold text-muted hover:text-foreground hover:border-accent/40 transition-colors shadow-sm"
          >
            <span>&larr;</span>
            <span>Back</span>
          </button>

          <button
            type="button"
            onClick={() => fetchRecs(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surface hover:bg-surfaceHover border border-border text-xs font-bold text-foreground transition-colors disabled:opacity-50"
          >
            <span className={refreshing ? "animate-spin" : ""}>🔄</span>
            <span>{refreshing ? "Updating..." : "Recalculate Taste"}</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/25 text-accent text-xs font-black uppercase tracking-wider mb-2">
              <span>✨</span>
              <span>AI Hybrid Recommendation Engine</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
              Recommended For You
            </h1>
            <p className="text-sm text-muted mt-1.5 max-w-3xl leading-relaxed">
              Tailored suggestions computed from over 339,000 verified manga, manhwa, and manhua titles.
              Powered by deep semantic vector embeddings matched to your library tracking and favorites.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="px-4 py-2 rounded-2xl bg-surface border border-border text-right shadow-sm">
              <div className="text-2xl font-black text-accent">{items.length}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Available Recs
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-2xl bg-surface border border-border shadow-sm">
        {/* Type Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: "all", label: "All Formats" },
            { id: "manga", label: "Manga" },
            { id: "manhwa", label: "Manhwa" },
            { id: "manhua", label: "Manhua" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSelectedType(tab.id);
                setVisibleCount(ITEMS_PER_PAGE);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                selectedType === tab.id
                  ? "bg-accent text-white shadow-sm"
                  : "text-muted hover:text-foreground hover:bg-surfaceHover"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters & Search Controls */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
          {/* Genre Dropdown */}
          <select
            value={selectedGenre}
            onChange={(e) => {
              setSelectedGenre(e.target.value);
              setVisibleCount(ITEMS_PER_PAGE);
            }}
            className="px-3 py-1.5 rounded-xl bg-ink border border-border text-xs font-semibold text-foreground focus:outline-none focus:border-accent"
          >
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-ink border border-border text-xs font-semibold text-foreground focus:outline-none focus:border-accent"
          >
            <option value="match">Sort: Best Match</option>
            <option value="rating">Sort: Highest Rating</option>
            <option value="alphabetical">Sort: A to Z</option>
          </select>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-48">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(ITEMS_PER_PAGE);
              }}
              placeholder="Search recommendations..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-ink border border-border text-xs text-foreground placeholder-muted focus:outline-none focus:border-accent"
            />
            <span className="absolute left-2.5 top-2 text-muted text-xs pointer-events-none">
              🔍
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-2 text-muted hover:text-foreground text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-24">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl bg-surface border border-border text-center space-y-3">
          <p className="text-sm font-semibold text-rose-400">{error}</p>
          <button
            type="button"
            onClick={() => fetchRecs()}
            className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accentHover transition"
          >
            Retry
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 rounded-3xl bg-surface border border-border text-center space-y-4">
          <div className="text-4xl">🔍</div>
          <h3 className="text-lg font-black text-foreground">No matching recommendations</h3>
          <p className="text-xs text-muted max-w-md mx-auto">
            No titles matched your current combination of genre, format, or search keyword.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedType("all");
              setSelectedGenre("All Genres");
              setSearchQuery("");
            }}
            className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accentHover transition"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Results Summary Bar */}
          <div className="flex items-center justify-between text-xs text-muted px-1">
            <span>
              Showing <strong className="text-foreground">{pagedItems.length}</strong> of{" "}
              <strong className="text-foreground">{filteredItems.length}</strong> recommendations
              {items.length !== filteredItems.length && ` (filtered from ${items.length})`}
            </span>
            <span className="hidden sm:inline">
              Sorted by:{" "}
              <strong className="text-foreground capitalize">
                {sortBy === "match" ? "Recommendation Confidence" : sortBy}
              </strong>
            </span>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-5 xl:gap-6">
            {pagedItems.map((manga, idx) => (
              <MangaCard
                key={manga.gold_id || idx}
                manga={manga}
                similarityScore={manga.similarity_score}
                rank={idx + 1}
              />
            ))}
          </div>

          {/* Pagination / Load More */}
          {hasMore && (
            <div className="flex flex-col items-center gap-3 pt-6">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
                className="px-8 py-3 rounded-2xl bg-surface hover:bg-surfaceHover border border-border hover:border-accent/40 font-bold text-sm text-foreground shadow-md transition-all duration-200"
              >
                Load More Recommendations ({filteredItems.length - pagedItems.length} remaining)
              </button>
              <span className="text-xs text-muted">
                Showing {pagedItems.length} of {filteredItems.length} titles
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
