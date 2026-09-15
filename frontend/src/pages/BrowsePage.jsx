import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import FilterBar from "../components/FilterBar";
import MangaGrid from "../components/MangaGrid";
import MangaListItem from "../components/MangaListItem";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import { browseManga, getGenres } from "../api/client";

const PAGE_SIZE = 24;

const LEGACY_SORT_MAP = {
  rating: "highest_rated",
  corroborated: "most_viewed_all",
  newest: "year_newest",
  title: "title_asc",
};

function filtersFromParams(searchParams) {
  const rawSort = searchParams.get("sort") || "highest_rated";
  const normalizedSort = LEGACY_SORT_MAP[rawSort] || rawSort;
  return {
    sort: normalizedSort,
    genres: searchParams.getAll("genre"),
    excludeGenres: searchParams.getAll("exclude_genre"),
    status: searchParams.get("status") || null,
    yearMin: searchParams.get("year_min") ? Number(searchParams.get("year_min")) : null,
    yearMax: searchParams.get("year_max") ? Number(searchParams.get("year_max")) : null,
    minChapters: searchParams.get("min_chapters") ? Number(searchParams.get("min_chapters")) : null,
    maxChapters: searchParams.get("max_chapters") ? Number(searchParams.get("max_chapters")) : null,
    minRating: searchParams.get("min_rating") ? Number(searchParams.get("min_rating")) : null,
    minSources: searchParams.get("min_sources") ? Number(searchParams.get("min_sources")) : null,
    hasOfficialLinks: searchParams.get("has_official_links") === "true",
    genreMatch: searchParams.get("genre_match") || "and",
    hideExplicit: searchParams.get("hide_explicit") !== "false",
    hideDoujinshi: searchParams.get("hide_doujinshi") !== "false",
  };
}

function paramsFromFilters(filters, query, page) {
  const params = new URLSearchParams();
  if (query && query.trim()) params.set("q", query.trim());
  if (filters.sort && filters.sort !== "highest_rated" && filters.sort !== "rating") {
    params.set("sort", filters.sort);
  }
  (filters.genres || []).forEach((g) => params.append("genre", g));
  (filters.excludeGenres || []).forEach((g) => params.append("exclude_genre", g));
  if (filters.status) params.set("status", filters.status);
  if (filters.yearMin != null) params.set("year_min", filters.yearMin);
  if (filters.yearMax != null) params.set("year_max", filters.yearMax);
  if (filters.minChapters != null) params.set("min_chapters", filters.minChapters);
  if (filters.maxChapters != null) params.set("max_chapters", filters.maxChapters);
  if (filters.minRating != null) params.set("min_rating", filters.minRating);
  if (filters.minSources != null) params.set("min_sources", filters.minSources);
  if (filters.hasOfficialLinks) params.set("has_official_links", "true");
  if (filters.genreMatch && filters.genreMatch !== "and") params.set("genre_match", filters.genreMatch);
  if (filters.hideExplicit === false) params.set("hide_explicit", "false");
  if (filters.hideDoujinshi === false) params.set("hide_doujinshi", "false");
  if (page > 0) params.set("page", page);
  return params;
}

export default function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const query = searchParams.get("q") || "";
  const page = Number(searchParams.get("page") || 0);

  const [viewMode, setViewMode] = useState("grid"); // "grid" | "list"
  const [allGenres, setAllGenres] = useState([]);
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const filters = useMemo(
    () => filtersFromParams(searchParams),
    [searchParams]
  );

  useEffect(() => {
    getGenres()
      .then((data) => setAllGenres(data.genres || []))
      .catch(() => setAllGenres([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    browseManga({
      q: query,
      genres: filters.genres,
      excludeGenres: filters.excludeGenres,
      status: filters.status,
      yearMin: filters.yearMin,
      yearMax: filters.yearMax,
      minChapters: filters.minChapters,
      maxChapters: filters.maxChapters,
      minRating: filters.minRating,
      minSources: filters.minSources,
      hasOfficialLinks: filters.hasOfficialLinks,
      genreMatch: filters.genreMatch,
      hideExplicit: filters.hideExplicit,
      hideDoujinshi: filters.hideDoujinshi,
      sort: filters.sort,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then((data) => {
        if (cancelled) return;
        setResults(data.results || []);
        setTotal(data.total ?? data.count ?? 0);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't reach the catalog browse API.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const handleQueryChange = useCallback(
    (newQuery) => {
      setSearchParams(paramsFromFilters(filters, newQuery, 0));
    },
    [filters, setSearchParams]
  );

  const handleFilterChange = useCallback(
    (newFilters) => {
      setSearchParams(paramsFromFilters(newFilters, query, 0));
    },
    [query, setSearchParams]
  );

  const handleReset = useCallback(() => {
    setSearchParams(
      paramsFromFilters(
        {
          sort: "highest_rated",
          genres: [],
          excludeGenres: [],
          status: null,
          genreMatch: "and",
          hideExplicit: true,
          hideDoujinshi: true,
          yearMin: null,
          yearMax: null,
          minChapters: null,
          maxChapters: null,
          minRating: null,
          minSources: null,
          hasOfficialLinks: null,
        },
        "",
        0
      )
    );
  }, [setSearchParams]);

  function goToPage(newPage) {
    setSearchParams(paramsFromFilters(filters, query, newPage));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSurpriseMe() {
    if (results && results.length > 0) {
      const pick = results[Math.floor(Math.random() * results.length)];
      if (pick && pick.gold_id) {
        navigate(`/manga/${encodeURIComponent(pick.gold_id)}`);
      }
    }
  }

  // Active filter chip helpers
  const removeGenre = useCallback(
    (g) => {
      handleFilterChange({
        ...filters,
        genres: (filters.genres || []).filter((item) => item !== g),
      });
    },
    [filters, handleFilterChange]
  );

  const removeExcludeGenre = useCallback(
    (g) => {
      handleFilterChange({
        ...filters,
        excludeGenres: (filters.excludeGenres || []).filter((item) => item !== g),
      });
    },
    [filters, handleFilterChange]
  );

  const activeChips = useMemo(() => {
    const chips = [];
    if (query) {
      chips.push({ id: "q", label: `Search: "${query}"`, onRemove: () => handleQueryChange("") });
    }
    (filters.genres || []).forEach((g) => {
      chips.push({ id: `inc_${g}`, label: `+ ${g}`, onRemove: () => removeGenre(g) });
    });
    (filters.excludeGenres || []).forEach((g) => {
      chips.push({ id: `exc_${g}`, label: `– ${g}`, onRemove: () => removeExcludeGenre(g), isExclude: true });
    });
    if (filters.status) {
      chips.push({
        id: "status",
        label: `Status: ${filters.status}`,
        onRemove: () => handleFilterChange({ ...filters, status: null }),
      });
    }
    if (filters.yearMin != null || filters.yearMax != null) {
      chips.push({
        id: "year",
        label: `Year: ${filters.yearMin ?? "…"}–${filters.yearMax ?? "…"}`,
        onRemove: () => handleFilterChange({ ...filters, yearMin: null, yearMax: null }),
      });
    }
    if (filters.minChapters != null || filters.maxChapters != null) {
      chips.push({
        id: "ch",
        label: `Ch: ${filters.minChapters ?? 0}–${filters.maxChapters ?? "…"}`,
        onRemove: () => handleFilterChange({ ...filters, minChapters: null, maxChapters: null }),
      });
    }
    if (filters.minRating != null) {
      chips.push({
        id: "rating",
        label: `Rating: ≥ ${filters.minRating}★`,
        onRemove: () => handleFilterChange({ ...filters, minRating: null }),
      });
    }
    if (filters.minSources != null) {
      chips.push({
        id: "sources",
        label: `Sources: ≥ ${filters.minSources}`,
        onRemove: () => handleFilterChange({ ...filters, minSources: null }),
      });
    }
    if (filters.hasOfficialLinks) {
      chips.push({
        id: "links",
        label: "Official Links",
        onRemove: () => handleFilterChange({ ...filters, hasOfficialLinks: null }),
      });
    }
    if (filters.hideExplicit === false) {
      chips.push({
        id: "nsfw",
        label: "NSFW Allowed",
        onRemove: () => handleFilterChange({ ...filters, hideExplicit: true }),
      });
    }
    if (filters.hideDoujinshi === false) {
      chips.push({
        id: "doujinshi",
        label: "Doujinshi Allowed",
        onRemove: () => handleFilterChange({ ...filters, hideDoujinshi: true }),
      });
    }
    return chips;
  }, [query, filters, handleQueryChange, handleFilterChange, removeGenre, removeExcludeGenre]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Top Filter and Search Bar */}
      <FilterBar
        allGenres={allGenres}
        filters={filters}
        query={query}
        onQueryChange={handleQueryChange}
        onChange={handleFilterChange}
        onReset={handleReset}
        onSurpriseMe={results.length > 0 ? handleSurpriseMe : null}
      />

      {/* Results Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-foreground">
            <span className="text-accent font-bold">{total.toLocaleString()}</span> manga found
          </span>

          {/* Active Filter Chips */}
          {activeChips.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeChips.map((chip) => (
                <span
                  key={chip.id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs border font-medium transition ${
                    chip.isExclude
                      ? "bg-rose-950/40 border-rose-500/50 text-rose-300"
                      : "bg-surface border-border text-foreground hover:border-accent"
                  }`}
                >
                  <span>{chip.label}</span>
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    className="text-muted hover:text-rose-400 font-bold ml-0.5 text-xs"
                    aria-label={`Remove ${chip.label}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
              {activeChips.length > 1 && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold ml-1 transition"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>

        {/* View Mode Toggle: Grid vs List */}
        <div className="inline-flex items-center rounded-xl bg-surface border border-border p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
              viewMode === "grid"
                ? "bg-accent text-black shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
            title="Grid view"
            aria-label="Grid view"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span className="hidden sm:inline">Grid</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
              viewMode === "list"
                ? "bg-accent text-black shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
            title="List view"
            aria-label="List view"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="hidden sm:inline">List</span>
          </button>
        </div>
      </div>

      {/* Loading / Error States */}
      {loading && <LoadingSpinner label="Searching catalog..." />}
      {error && <ErrorMessage message={error} onRetry={() => goToPage(page)} />}

      {/* Results Content */}
      {!loading && !error && (
        <>
          {results.length === 0 ? (
            <div className="text-center py-20 px-4 rounded-3xl bg-surface border border-border shadow-sm space-y-4">
              <div className="text-4xl">🔍</div>
              <h3 className="text-lg font-bold text-foreground">No manga match your filters</h3>
              <p className="text-xs text-muted max-w-md mx-auto">
                Try widening your search terms, changing the genre match mode, or removing some of your active filter constraints.
              </p>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-xl bg-accent text-black font-semibold text-xs hover:brightness-110 active:scale-95 transition shadow"
              >
                Reset All Filters
              </button>
            </div>
          ) : viewMode === "grid" ? (
            <MangaGrid items={results} />
          ) : (
            <div className="space-y-2.5">
              {results.map((manga) => (
                <MangaListItem key={manga.gold_id} manga={manga} />
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-8 pb-6">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => goToPage(page - 1)}
                className="px-5 py-2.5 rounded-xl bg-surface border border-border text-sm text-foreground font-semibold disabled:opacity-30 hover:bg-surfaceHover hover:border-accent/60 transition min-h-[44px] flex items-center gap-1.5 shadow-sm"
              >
                <span>←</span>
                <span>Previous</span>
              </button>
              <span className="text-xs sm:text-sm text-muted px-2">
                Page <span className="font-bold text-foreground">{page + 1}</span> of{" "}
                <span className="font-bold text-foreground">{totalPages.toLocaleString()}</span>
              </span>
              <button
                type="button"
                disabled={page + 1 >= totalPages}
                onClick={() => goToPage(page + 1)}
                className="px-5 py-2.5 rounded-xl bg-surface border border-border text-sm text-foreground font-semibold disabled:opacity-30 hover:bg-surfaceHover hover:border-accent/60 transition min-h-[44px] flex items-center gap-1.5 shadow-sm"
              >
                <span>Next</span>
                <span>→</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
