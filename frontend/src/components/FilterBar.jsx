import { useState, useEffect } from "react";
import CustomSelect from "./CustomSelect";
import MultiSelectDropdown from "./MultiSelectDropdown";
import GenreFilterPopover from "./GenreFilterPopover";

const SORT_OPTIONS = [
  { value: "best_match", label: "Best match" },
  { value: "latest_update", label: "Latest update" },
  { value: "recently_added", label: "Recently added" },
  { value: "title_asc", label: "Title (A–Z)" },
  { value: "title_desc", label: "Title (Z–A)" },
  { value: "year_newest", label: "Year (newest)" },
  { value: "year_oldest", label: "Year (oldest)" },
  { value: "highest_rated", label: "Highest rated" },
  { value: "most_viewed_7d", label: "Most viewed · 7 days" },
  { value: "most_viewed_30d", label: "Most viewed · 30 days" },
  { value: "most_viewed_90d", label: "Most viewed · 90 days" },
  { value: "most_viewed_all", label: "Most viewed · all time" },
  { value: "most_followed", label: "Most followed" },
];

const LEGACY_SORT_MAP = {
  rating: "highest_rated",
  corroborated: "most_viewed_all",
  newest: "year_newest",
  title: "title_asc",
};

const STATUS_OPTIONS = [
  { value: "", label: "Any Status" },
  { value: "releasing", label: "Releasing / Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "hiatus", label: "On Hiatus" },
  { value: "cancelled", label: "Cancelled" },
];

const RATING_OPTIONS = [
  { value: "", label: "Any Rating" },
  { value: "7.0", label: "★ 7.0+" },
  { value: "8.0", label: "★ 8.0+ (Great)" },
  { value: "8.5", label: "★ 8.5+ (Acclaimed)" },
  { value: "9.0", label: "★ 9.0+ (Masterpiece)" },
];

const SOURCES_OPTIONS = [
  { value: "", label: "Any Source Count" },
  { value: "2", label: "2+ Corroborating Sources" },
  { value: "3", label: "3 Sources (AniList + MD + MU)" },
];

const DEMOGRAPHIC_TAGS = ["Shounen", "Seinen", "Shoujo", "Josei"];

export default function FilterBar({
  allGenres = [],
  filters,
  query,
  onQueryChange,
  onChange,
  onReset,
  onSurpriseMe,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [prevQuery, setPrevQuery] = useState(query);
  const [searchInput, setSearchInput] = useState(query || "");

  if (query !== prevQuery) {
    setPrevQuery(query);
    setSearchInput(query || "");
  }

  // Count active filters (excluding sort and default safety toggles)
  const activeAdvancedCount =
    (filters.excludeGenres || []).length +
    (filters.yearMin != null ? 1 : 0) +
    (filters.yearMax != null ? 1 : 0) +
    (filters.minChapters != null ? 1 : 0) +
    (filters.maxChapters != null ? 1 : 0) +
    (filters.minRating != null ? 1 : 0) +
    (filters.minSources != null ? 1 : 0) +
    (filters.hasOfficialLinks ? 1 : 0) +
    (!filters.hideExplicit ? 1 : 0) +
    (!filters.hideDoujinshi ? 1 : 0);

  const totalFilterCount =
    (filters.genres || []).length +
    (filters.status ? 1 : 0) +
    activeAdvancedCount;

  function handleSearchSubmit(e) {
    e.preventDefault();
    onQueryChange(searchInput.trim());
  }

  function handleSearchClear() {
    setSearchInput("");
    onQueryChange("");
  }

  function toggleDemographic(tag) {
    const current = filters.genres || [];
    if (current.includes(tag)) {
      onChange({ ...filters, genres: current.filter((g) => g !== tag) });
    } else {
      onChange({ ...filters, genres: [...current, tag] });
    }
  }

  // Handle escape to close advanced drawer on mobile
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && advancedOpen) {
        setAdvancedOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [advancedOpen]);

  return (
    <div className="rounded-3xl bg-surface border border-border p-4 sm:p-5 mb-6 shadow-themeCard">
      {/* Top Search Bar */}
      <form onSubmit={handleSearchSubmit} className="mb-4">
        <div className="relative flex items-center">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search manga by title in combination with filters..."
            className="w-full rounded-2xl bg-ink border border-border pl-10 pr-24 py-2.5 sm:py-3 text-sm text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchInput && (
              <button
                type="button"
                onClick={handleSearchClear}
                className="p-1 text-muted hover:text-foreground text-xs rounded transition"
                title="Clear search"
              >
                ✕
              </button>
            )}
            <button
              type="submit"
              className="px-3 py-1 rounded-xl bg-accent text-black font-semibold text-xs hover:brightness-110 active:scale-95 transition"
            >
              Search
            </button>
          </div>
        </div>
      </form>

      {/* Primary Essentials Controls Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 items-end">
        {/* Sort */}
        <CustomSelect
          label="Sort by"
          value={LEGACY_SORT_MAP[filters.sort] || filters.sort || "highest_rated"}
          options={SORT_OPTIONS}
          onChange={(val) => onChange({ ...filters, sort: val })}
        />

        {/* Status */}
        <MultiSelectDropdown
          label="Status"
          value={filters.status || ""}
          options={STATUS_OPTIONS}
          placeholder="Any Status"
          onChange={(val) => onChange({ ...filters, status: val || null })}
        />

        {/* Genres Popover */}
        <GenreFilterPopover
          allGenres={allGenres}
          included={filters.genres || []}
          excluded={filters.excludeGenres || []}
          matchMode={filters.genreMatch || "and"}
          onChangeIncluded={(genres) => onChange({ ...filters, genres })}
          onChangeExcluded={(excludeGenres) => onChange({ ...filters, excludeGenres })}
          onMatchModeChange={(genreMatch) => onChange({ ...filters, genreMatch })}
        />

        {/* Demographics Quick Pills (Desktop span 2) */}
        <div className="col-span-2 hidden lg:block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
            Demographic
          </span>
          <div className="flex items-center gap-1.5 h-[44px]">
            {DEMOGRAPHIC_TAGS.map((tag) => {
              const active = (filters.genres || []).includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleDemographic(tag)}
                  className={`px-3.5 h-[44px] rounded-xl text-xs font-semibold border transition flex items-center justify-center ${
                    active
                      ? "bg-accentSoft border-accent text-accent shadow-sm"
                      : "bg-ink border-border text-foreground hover:bg-surfaceHover hover:border-border"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions Cluster: Advanced Filters Toggle & Surprise Me */}
        <div className="col-span-2 sm:col-span-3 lg:col-span-1 flex items-end gap-2">
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-expanded={advancedOpen}
            className={`flex-1 h-[44px] flex items-center justify-center gap-1.5 px-3 rounded-xl border text-xs font-semibold transition ${
              advancedOpen || activeAdvancedCount > 0
                ? "bg-accentSoft border-accent text-accent shadow-sm"
                : "bg-ink border-border text-foreground hover:bg-surfaceHover hover:border-border"
            }`}
          >
            <span>⚙️ Filters</span>
            {activeAdvancedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-accent text-black font-bold text-[10px]">
                {activeAdvancedCount}
              </span>
            )}
            <svg
              className={`h-3.5 w-3.5 text-muted transition-transform duration-200 ${
                advancedOpen ? "rotate-180 text-accent" : ""
              }`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {onSurpriseMe && (
            <button
              type="button"
              onClick={onSurpriseMe}
              title="Surprise Me: pick a random manga matching all current filters"
              className="h-[44px] px-3.5 rounded-xl bg-ink border border-border text-foreground hover:text-accent hover:border-accent hover:bg-surfaceHover text-xs font-semibold transition flex items-center justify-center gap-1"
            >
              <span>🎲</span>
              <span className="hidden sm:inline">Surprise</span>
            </button>
          )}
        </div>
      </div>

      {/* Progressively Disclosed Advanced Filters: Inline on Desktop */}
      {advancedOpen && (
        <div className="mt-4 pt-4 border-t border-border animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Release Year Range */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
                Release Year Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min (1950)"
                  min={1950}
                  max={2026}
                  value={filters.yearMin ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...filters,
                      yearMin: e.target.value ? Math.max(1950, Math.min(2026, Number(e.target.value))) : null,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-ink border border-border text-xs text-foreground placeholder-muted focus:outline-none focus:border-accent"
                />
                <span className="text-muted">–</span>
                <input
                  type="number"
                  placeholder="Max (2026)"
                  min={1950}
                  max={2026}
                  value={filters.yearMax ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...filters,
                      yearMax: e.target.value ? Math.max(1950, Math.min(2026, Number(e.target.value))) : null,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-ink border border-border text-xs text-foreground placeholder-muted focus:outline-none focus:border-accent"
                />
              </div>
              {filters.yearMin && filters.yearMax && filters.yearMin > filters.yearMax && (
                <p className="text-[10px] text-rose-400 mt-1">Min year cannot exceed max year</p>
              )}
            </div>

            {/* Chapter Count Range */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
                Chapters Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min (0)"
                  min={0}
                  value={filters.minChapters ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...filters,
                      minChapters: e.target.value ? Math.max(0, Number(e.target.value)) : null,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-ink border border-border text-xs text-foreground placeholder-muted focus:outline-none focus:border-accent"
                />
                <span className="text-muted">–</span>
                <input
                  type="number"
                  placeholder="Max"
                  min={0}
                  value={filters.maxChapters ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...filters,
                      maxChapters: e.target.value ? Math.max(0, Number(e.target.value)) : null,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-ink border border-border text-xs text-foreground placeholder-muted focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            {/* Minimum Rating */}
            <CustomSelect
              label="Minimum Rating"
              value={filters.minRating != null ? String(filters.minRating) : ""}
              options={RATING_OPTIONS}
              onChange={(val) =>
                onChange({ ...filters, minRating: val ? Number(val) : null })
              }
            />

            {/* Corroborating Sources */}
            <CustomSelect
              label="Corroborating Sources"
              value={filters.minSources != null ? String(filters.minSources) : ""}
              options={SOURCES_OPTIONS}
              onChange={(val) =>
                onChange({ ...filters, minSources: val ? Number(val) : null })
              }
            />
          </div>

          {/* Secondary Row: Demographics on mobile + Official Links + Safety Toggles */}
          <div className="mt-4 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-4">
            {/* Demographics for mobile/tablet */}
            <div className="lg:hidden flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted mr-1">
                Demographic:
              </span>
              {DEMOGRAPHIC_TAGS.map((tag) => {
                const active = (filters.genres || []).includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleDemographic(tag)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                      active
                        ? "bg-accentSoft border-accent text-accent"
                        : "bg-ink border-border text-foreground hover:bg-surfaceHover"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            {/* Toggles: Official Links, NSFW, Doujinshi */}
            <div className="flex items-center gap-4 flex-wrap text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(filters.hasOfficialLinks)}
                  onChange={(e) =>
                    onChange({ ...filters, hasOfficialLinks: e.target.checked })
                  }
                  className="rounded border-border text-accent focus:ring-accent bg-ink h-4 w-4"
                />
                <span className="text-foreground">Official Links Only</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filters.hideExplicit !== false}
                  onChange={(e) =>
                    onChange({ ...filters, hideExplicit: e.target.checked })
                  }
                  className="rounded border-border text-accent focus:ring-accent bg-ink h-4 w-4"
                />
                <span className="text-foreground">Hide NSFW / 18+</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filters.hideDoujinshi !== false}
                  onChange={(e) =>
                    onChange({ ...filters, hideDoujinshi: e.target.checked })
                  }
                  className="rounded border-border text-accent focus:ring-accent bg-ink h-4 w-4"
                />
                <span className="text-foreground">Hide Doujinshi</span>
              </label>
            </div>

            {/* Reset Button */}
            {totalFilterCount > 0 && (
              <button
                type="button"
                onClick={onReset}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold transition flex items-center gap-1"
              >
                <span>↺</span> Reset All Filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
