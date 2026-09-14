import { useEffect, useRef, useState } from "react";

const DEMOGRAPHIC_TAGS = ["Shounen", "Seinen", "Shoujo", "Josei"];

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

export default function AdvancedFilterDrawer({
  isOpen,
  onClose,
  allGenres,
  filters,
  onChange,
  onReset,
}) {
  const [excludeSearch, setExcludeSearch] = useState("");
  const drawerRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const excludeSuggestions = excludeSearch.trim()
    ? allGenres
        .filter(
          (g) =>
            g.toLowerCase().includes(excludeSearch.trim().toLowerCase()) &&
            !(filters.excludeGenres || []).includes(g) &&
            !(filters.genres || []).includes(g)
        )
        .slice(0, 8)
    : [];

  function addExcludeGenre(genre) {
    const current = filters.excludeGenres || [];
    if (!current.includes(genre)) {
      onChange({ ...filters, excludeGenres: [...current, genre] });
    }
    setExcludeSearch("");
  }

  function removeExcludeGenre(genre) {
    const current = filters.excludeGenres || [];
    onChange({ ...filters, excludeGenres: current.filter((g) => g !== genre) });
  }

  function toggleDemographic(tag) {
    const current = filters.genres || [];
    if (current.includes(tag)) {
      onChange({ ...filters, genres: current.filter((g) => g !== tag) });
    } else {
      onChange({ ...filters, genres: [...current, tag] });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className="relative w-full max-w-md h-full bg-surface border-l border-border shadow-2xl flex flex-col z-10 overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚙️</span>
            <h3 className="text-base font-bold text-foreground">Advanced Filters</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close advanced filters"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surfaceHover transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Publication Status */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-2">
              Publication Status
            </label>
            <select
              value={filters.status || ""}
              onChange={(e) => onChange({ ...filters, status: e.target.value || null })}
              className="w-full px-3 py-2 rounded-lg bg-ink border border-border text-sm text-foreground focus:outline-none focus:border-accent"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Demographics */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-2">
              Target Demographic
            </label>
            <div className="flex flex-wrap gap-2">
              {DEMOGRAPHIC_TAGS.map((demo) => {
                const active = (filters.genres || []).includes(demo);
                return (
                  <button
                    key={demo}
                    type="button"
                    onClick={() => toggleDemographic(demo)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
                      active
                        ? "bg-accent text-accentForeground border-accent shadow-sm"
                        : "bg-ink border-border text-muted hover:text-foreground hover:border-accent/40"
                    }`}
                  >
                    {demo}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minimum Rating */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-2">
              Minimum Community Score
            </label>
            <select
              value={filters.minRating != null ? String(filters.minRating) : ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  minRating: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="w-full px-3 py-2 rounded-lg bg-ink border border-border text-sm text-foreground focus:outline-none focus:border-accent"
            >
              {RATING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Chapter Range */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-2">
              Chapter Count Range
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                placeholder="Min chapters"
                value={filters.minChapters ?? ""}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    minChapters: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full px-3 py-2 rounded-lg bg-ink border border-border text-sm text-foreground placeholder-muted/50 focus:outline-none focus:border-accent"
              />
              <span className="text-muted">–</span>
              <input
                type="number"
                min="0"
                placeholder="Max chapters"
                value={filters.maxChapters ?? ""}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    maxChapters: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full px-3 py-2 rounded-lg bg-ink border border-border text-sm text-foreground placeholder-muted/50 focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Exclude Genres */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">
                Exclude Genres / Tags
              </label>
              {(filters.excludeGenres || []).length > 0 && (
                <span className="text-xs text-accent">
                  {(filters.excludeGenres || []).length} excluded
                </span>
              )}
            </div>
            <div className="relative mb-2">
              <input
                type="text"
                value={excludeSearch}
                onChange={(e) => setExcludeSearch(e.target.value)}
                placeholder="Type tag to exclude..."
                className="w-full px-3 py-2 rounded-lg bg-ink border border-border text-sm text-foreground placeholder-muted/50 focus:outline-none focus:border-accent"
              />
              {excludeSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-surface border border-border rounded-lg shadow-xl p-1 max-h-40 overflow-y-auto">
                  {excludeSuggestions.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => addExcludeGenre(g)}
                      className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-surfaceHover rounded transition flex items-center justify-between"
                    >
                      <span>{g}</span>
                      <span className="text-red-400 font-bold">+ Exclude</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {(filters.excludeGenres || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(filters.excludeGenres || []).map((g) => (
                  <span
                    key={g}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-300"
                  >
                    <span>✕ {g}</span>
                    <button
                      type="button"
                      onClick={() => removeExcludeGenre(g)}
                      className="hover:text-red-100 font-bold ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Cross-Source Corroboration */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-2">
              Multi-Source Verification
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: null, label: "Any" },
                { val: 2, label: "2+ Sources" },
                { val: 3, label: "3 Sources (All)" },
              ].map((opt) => {
                const active = filters.minSources === opt.val;
                return (
                  <button
                    key={String(opt.val)}
                    type="button"
                    onClick={() => onChange({ ...filters, minSources: opt.val })}
                    className={`text-xs py-2 px-2 rounded-lg border text-center font-medium transition ${
                      active
                        ? "bg-accent text-accentForeground border-accent shadow-sm"
                        : "bg-ink border-border text-muted hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Official Reading Link Toggle */}
          <div className="pt-2 border-t border-border">
            <label className="flex items-center gap-3 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={Boolean(filters.hasOfficialLinks)}
                onChange={(e) =>
                  onChange({ ...filters, hasOfficialLinks: e.target.checked ? true : null })
                }
                className="accent-accent w-4 h-4 rounded"
              />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Official Reading Availability
                </p>
                <p className="text-xs text-muted">
                  Only show manga with confirmed links to MANGA Plus, MangaDex, or official sites
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-surface/50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-bold text-muted hover:text-foreground px-3 py-2 rounded-lg transition"
          >
            Reset All Filters
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-accent text-accentForeground text-xs font-bold shadow hover:opacity-90 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
