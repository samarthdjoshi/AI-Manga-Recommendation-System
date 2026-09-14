import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getSuggestions } from "../api/client";
import SearchSuggestDropdown from "./SearchSuggestDropdown";

const DEBOUNCE_MS = 120;

export default function SearchBar({
  onSearch,
  initialValue = "",
  compact = false,
  dropdownAlign = "left",
  placeholder = "Search 339k+ manga, manhwa...",
}) {
  const navigate = useNavigate();
  const [value, setValue] = useState(initialValue);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const cacheRef = useRef(new Map());
  const currentQueryRef = useRef(initialValue);

  const [prevInitial, setPrevInitial] = useState(initialValue);
  if (initialValue !== prevInitial) {
    setPrevInitial(initialValue);
    setValue(initialValue || "");
  }

  useEffect(() => {
    currentQueryRef.current = initialValue || "";
  }, [initialValue]);

  const fetchSuggestions = useCallback((text) => {
    const trimmed = text.trim();
    if (!trimmed) {
      if (abortRef.current) abortRef.current.abort();
      setSuggestions([]);
      setSelectedIndex(-1);
      return;
    }

    if (cacheRef.current.has(trimmed)) {
      setSuggestions(cacheRef.current.get(trimmed));
      setSelectedIndex(-1);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    getSuggestions(trimmed, 6, { signal: controller.signal })
      .then((data) => {
        if (currentQueryRef.current.trim() === trimmed) {
          const results = data.results || [];
          cacheRef.current.set(trimmed, results);
          setSuggestions(results);
          setSelectedIndex(-1);
        }
      })
      .catch((err) => {
        if (err?.name === "CanceledError" || err?.name === "AbortError" || err?.code === "ERR_CANCELED") {
          return;
        }
        if (currentQueryRef.current.trim() === trimmed) {
          setSuggestions([]);
          setSelectedIndex(-1);
        }
      });
  }, []);

  function handleChange(e) {
    const text = e.target.value;
    setValue(text);
    currentQueryRef.current = text;
    setSelectedIndex(-1);
    setOpen(true);

    const trimmed = text.trim();
    if (!trimmed) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
      setSuggestions([]);
      return;
    }

    if (cacheRef.current.has(trimmed)) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSuggestions(cacheRef.current.get(trimmed));
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), DEBOUNCE_MS);
  }

  function handleKeyDown(e) {
    if (!open || suggestions.length === 0) {
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === "Enter" && selectedIndex >= 0 && suggestions[selectedIndex]) {
      e.preventDefault();
      const chosen = suggestions[selectedIndex];
      setOpen(false);
      navigate(`/manga/${encodeURIComponent(chosen.gold_id)}`);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      const chosen = suggestions[selectedIndex];
      setOpen(false);
      navigate(`/manga/${encodeURIComponent(chosen.gold_id)}`);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    setOpen(false);
    onSearch(value);
  }

  function handleClear() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    setValue("");
    currentQueryRef.current = "";
    setSuggestions([]);
    setSelectedIndex(-1);
    setOpen(false);
    onSearch("");
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleEscape(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit} className="w-full">
        <div className="relative flex items-center">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => value && setOpen(true)}
            onClick={() => value && setOpen(true)}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck="false"
            className={`w-full rounded-xl bg-surface border border-border pl-10 pr-10 text-foreground placeholder-muted
                       focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all shadow-sm
                       ${compact ? "py-2.5 text-xs sm:text-sm" : "py-3.5 text-base"}`}
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground p-1 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40"
              aria-label="Clear search input"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </form>

      {open && (
        <SearchSuggestDropdown
          results={suggestions}
          query={value}
          dropdownAlign={dropdownAlign}
          selectedIndex={selectedIndex}
          onSelect={() => setOpen(false)}
          onViewAll={() => {
            setOpen(false);
            onSearch(value);
          }}
        />
      )}
    </div>
  );
}
