import { useState, useMemo, useRef, useEffect } from "react";

const COMMON_GENRES = [
  "Action", "Adult", "Adventure", "Boys' Love",
  "Comedy", "Crime", "Drama", "Ecchi",
  "Fantasy", "Girls' Love", "Harem", "Hentai",
  "Historical", "Horror", "Isekai", "Magical Girls",
  "Mature", "Mecha", "Medical", "Mystery",
  "Philosophical", "Psychological", "Romance", "Sci-Fi",
  "Slice of Life", "Smut", "Sports", "Superhero",
  "Thriller", "Tragedy", "Wuxia",
];

const FORMAT_TAGS = [
  "4-Koma", "Adaptation", "Anthology", "Award Winning",
  "Doujinshi", "Full Color", "Long Strip", "Oneshot",
  "Web Comic",
];

export default function GenreFilterPanel({ allGenres, selected, matchMode, onChange, onMatchModeChange }) {
  const [open, setOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const panelRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const tagSuggestions = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    if (!q) return [];
    return allGenres
      .filter((g) => g.toLowerCase().includes(q) && !selected.includes(g))
      .slice(0, 8);
  }, [allGenres, tagSearch, selected]);

  function toggleGenre(genre) {
    if (selected.includes(genre)) {
      onChange(selected.filter((g) => g !== genre));
    } else {
      onChange([...selected, genre]);
    }
  }

  function addTag(genre) {
    if (!selected.includes(genre)) onChange([...selected, genre]);
    setTagSearch("");
  }

  function handleTagKeyDown(e) {
    if (e.key === "Enter" && tagSuggestions.length > 0) {
      e.preventDefault();
      addTag(tagSuggestions[0]);
    }
  }

  const extraSelected = selected.filter(
    (g) => !COMMON_GENRES.includes(g) && !FORMAT_TAGS.includes(g)
  );

  return (
    <div className="relative" ref={panelRef}>
      <label className="filter-label block mb-1">Genres</label>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full min-w-[140px] px-3 py-2 rounded-lg bg-ink border border-border
                   text-sm text-white/80 hover:border-accent transition flex items-center justify-between gap-2"
      >
        <span>
          {selected.length === 0 ? "Any" : `${selected.length} selected`}
        </span>
        <span className="text-white/40">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          className="absolute z-20 mt-2 w-[420px] max-h-[480px] overflow-y-auto rounded-xl
                     bg-surface border border-border shadow-2xl p-4 right-0"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="filter-label">Match</span>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => onMatchModeChange("and")}
                className={`px-3 py-1 text-xs font-medium transition ${
                  matchMode === "and" ? "bg-accent text-white" : "text-white/50 hover:bg-surfaceHover"
                }`}
              >
                AND
              </button>
              <button
                onClick={() => onMatchModeChange("or")}
                className={`px-3 py-1 text-xs font-medium transition ${
                  matchMode === "or" ? "bg-accent text-white" : "text-white/50 hover:bg-surfaceHover"
                }`}
              >
                OR
              </button>
            </div>
          </div>

          <p className="filter-label mb-2">Tags</p>
          <div className="relative mb-3">
            <input
              type="text"
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Type to add a tag, press Enter..."
              className="w-full px-3 py-1.5 rounded-md bg-ink border border-border
                         text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent"
            />
            {tagSuggestions.length > 0 && (
              <div className="absolute z-30 mt-1 w-full rounded-md bg-ink border border-border shadow-xl overflow-hidden">
                {tagSuggestions.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => addTag(genre)}
                    className="w-full text-left px-3 py-1.5 text-sm text-white/70 hover:bg-surfaceHover"
                  >
                    {genre}
                  </button>
                ))}
              </div>
            )}
          </div>

          {extraSelected.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {extraSelected.map((genre) => (
                <span
                  key={genre}
                  className="flex items-center gap-1 px-2 py-1 rounded-full bg-accentSoft text-accent text-xs"
                >
                  {genre}
                  <button onClick={() => toggleGenre(genre)} className="hover:text-white">×</button>
                </span>
              ))}
            </div>
          )}

          <p className="filter-label mb-2">Genres</p>
          <div className="grid grid-cols-3 gap-1">
            {COMMON_GENRES.map((genre) => (
              <label
                key={genre}
                className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-surfaceHover
                           cursor-pointer text-xs text-white/70 truncate"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(genre)}
                  onChange={() => toggleGenre(genre)}
                  className="accent-accent shrink-0"
                />
                <span className="truncate">{genre}</span>
              </label>
            ))}
          </div>

          <p className="filter-label mb-2 mt-3">Formats</p>
          <div className="grid grid-cols-3 gap-1">
            {FORMAT_TAGS.map((genre) => (
              <label
                key={genre}
                className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-surfaceHover
                           cursor-pointer text-xs text-white/70 truncate"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(genre)}
                  onChange={() => toggleGenre(genre)}
                  className="accent-accent shrink-0"
                />
                <span className="truncate">{genre}</span>
              </label>
            ))}
          </div>

          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="text-xs text-accent hover:underline mt-3"
            >
              Clear {selected.length} selected
            </button>
          )}
        </div>
      )}
    </div>
  );
}

