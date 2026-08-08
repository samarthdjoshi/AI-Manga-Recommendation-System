import GenreFilterPanel from "./GenreFilterPanel";

const SORT_OPTIONS = [
  { value: "rating", label: "Top rated" },
  { value: "corroborated", label: "Fully corroborated" },
  { value: "newest", label: "Newest" },
  { value: "title", label: "Title (A-Z)" },
];

export default function FilterBar({ allGenres, filters, onChange, onReset }) {
  const hasActiveFilters =
    filters.genres.length > 0 ||
    filters.yearMin ||
    filters.yearMax ||
    filters.minChapters;

  return (
    <div className="rounded-xl bg-surface border border-border p-4 mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
        <div>
          <label className="filter-label block mb-1">Sort by</label>
          <select
            value={filters.sort}
            onChange={(e) => onChange({ ...filters, sort: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-ink border border-border text-sm text-white/80
                       focus:outline-none focus:border-accent"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <GenreFilterPanel
          allGenres={allGenres}
          selected={filters.genres}
          matchMode={filters.genreMatch}
          onChange={(genres) => onChange({ ...filters, genres })}
          onMatchModeChange={(genreMatch) => onChange({ ...filters, genreMatch })}
        />

        <div>
          <label className="filter-label block mb-1">Release year</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="From"
              value={filters.yearMin ?? ""}
              onChange={(e) =>
                onChange({ ...filters, yearMin: e.target.value ? Number(e.target.value) : null })
              }
              className="w-full px-3 py-2 rounded-lg bg-ink border border-border text-sm text-white
                         placeholder-white/30 focus:outline-none focus:border-accent"
            />
            <span className="text-white/30">–</span>
            <input
              type="number"
              placeholder="To"
              value={filters.yearMax ?? ""}
              onChange={(e) =>
                onChange({ ...filters, yearMax: e.target.value ? Number(e.target.value) : null })
              }
              className="w-full px-3 py-2 rounded-lg bg-ink border border-border text-sm text-white
                         placeholder-white/30 focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <div>
          <label className="filter-label block mb-1">Minimum chapter</label>
          <input
            type="number"
            min="0"
            placeholder="Any"
            value={filters.minChapters ?? ""}
            onChange={(e) =>
              onChange({ ...filters, minChapters: e.target.value ? Number(e.target.value) : null })
            }
            className="w-full px-3 py-2 rounded-lg bg-ink border border-border text-sm text-white
                       placeholder-white/30 focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.hideExplicit}
            onChange={(e) => onChange({ ...filters, hideExplicit: e.target.checked })}
            className="accent-accent"
          />
          Hide explicit content
        </label>
      </div>

      {hasActiveFilters && (
        <div className="flex justify-end mt-3">
          <button
            onClick={onReset}
            className="text-sm text-white/50 hover:text-white underline"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}

