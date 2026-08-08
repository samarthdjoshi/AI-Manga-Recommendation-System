import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import FilterBar from "../components/FilterBar";
import MangaGrid from "../components/MangaGrid";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import { searchManga, browseManga, getGenres } from "../api/client";

const PAGE_SIZE = 24;

function filtersFromParams(searchParams) {
  return {
    sort: searchParams.get("sort") || "rating",
    genres: searchParams.getAll("genre"),
    yearMin: searchParams.get("year_min") ? Number(searchParams.get("year_min")) : null,
    yearMax: searchParams.get("year_max") ? Number(searchParams.get("year_max")) : null,
    minChapters: searchParams.get("min_chapters") ? Number(searchParams.get("min_chapters")) : null,
    genreMatch: searchParams.get("genre_match") || "and",
    hideExplicit: searchParams.get("hide_explicit") !== "false",
  };
}

function paramsFromFilters(filters, query, page) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("sort", filters.sort);
  filters.genres.forEach((g) => params.append("genre", g));
  if (filters.yearMin != null) params.set("year_min", filters.yearMin);
  if (filters.yearMax != null) params.set("year_max", filters.yearMax);
  if (filters.minChapters != null) params.set("min_chapters", filters.minChapters);
  if (filters.genreMatch && filters.genreMatch !== "and") params.set("genre_match", filters.genreMatch);
  if (filters.hideExplicit === false) params.set("hide_explicit", "false");
  if (page > 0) params.set("page", page);
  return params;
}

export default function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const page = Number(searchParams.get("page") || 0);
  const filters = filtersFromParams(searchParams);

  const [allGenres, setAllGenres] = useState([]);
  const [results, setResults] = useState([]);
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getGenres()
      .then((data) => setAllGenres(data.genres || []))
      .catch(() => setAllGenres([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const request = query
      ? searchManga(query, 25)
      : browseManga({
          genres: filters.genres,
          yearMin: filters.yearMin,
          yearMax: filters.yearMax,
          minChapters: filters.minChapters,
          genreMatch: filters.genreMatch,
          hideExplicit: filters.hideExplicit,
          sort: filters.sort,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        });

    request
      .then((data) => {
        if (cancelled) return;
        setResults(data.results || []);
        setCount(data.count || 0);
        setTotal(data.total ?? data.count ?? 0);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't reach the recommendation API.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    query,
    filters.sort,
    filters.genres.join(","),
    filters.genreMatch,
    filters.hideExplicit,
    filters.yearMin,
    filters.yearMax,
    filters.minChapters,
    page,
  ]);

  function handleSearch(newQuery) {
    if (newQuery && newQuery.trim()) {
      setSearchParams(paramsFromFilters(filters, newQuery.trim(), 0));
    } else {
      setSearchParams(paramsFromFilters(filters, "", 0));
    }
  }

  const handleFilterChange = useCallback(
    (newFilters) => {
      setSearchParams(paramsFromFilters(newFilters, "", 0));
    },
    [setSearchParams]
  );

  function handleReset() {
    setSearchParams(paramsFromFilters(
      { sort: "rating", genres: [], genreMatch: "and", hideExplicit: true, yearMin: null, yearMax: null, minChapters: null },
      "",
      0
    ));
  }

  function goToPage(newPage) {
    setSearchParams(paramsFromFilters(filters, "", newPage));
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mb-6">
        <SearchBar onSearch={handleSearch} initialValue={query} />
      </div>

      {!query && (
        <FilterBar
          allGenres={allGenres}
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleReset}
        />
      )}

      {loading && <LoadingSpinner label={query ? "Searching..." : "Loading..."} />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && query && (
        <>
          <p className="filter-label mb-4">
            {count} result{count !== 1 ? "s" : ""} for "{query}"
          </p>
          {results.length === 0 ? (
            <p className="text-white/40 py-16 text-center">
              No titles matched that search.
            </p>
          ) : (
            <MangaGrid items={results} />
          )}
        </>
      )}

      {!loading && !error && !query && (
        <>
          <p className="filter-label mb-4">
            {total.toLocaleString()} title{total !== 1 ? "s" : ""}
          </p>
          {results.length === 0 ? (
            <p className="text-white/40 py-16 text-center">
              No titles match these filters.
            </p>
          ) : (
            <>
              <MangaGrid items={results} />
              <div className="flex items-center justify-center gap-4 mt-8">
                <button
                  disabled={page === 0}
                  onClick={() => goToPage(page - 1)}
                  className="px-4 py-2 rounded-lg bg-surface border border-border text-sm
                             text-white/70 disabled:opacity-30 hover:bg-surfaceHover transition"
                >
                  Previous
                </button>
                <span className="text-sm text-white/40">
                  Page {page + 1} of {totalPages.toLocaleString()}
                </span>
                <button
                  disabled={page + 1 >= totalPages}
                  onClick={() => goToPage(page + 1)}
                  className="px-4 py-2 rounded-lg bg-surface border border-border text-sm
                             text-white/70 disabled:opacity-30 hover:bg-surfaceHover transition"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}




