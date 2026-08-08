import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getSuggestions } from "../api/client";
import SearchSuggestDropdown from "./SearchSuggestDropdown";

const DEBOUNCE_MS = 250;

export default function SearchBar({ onSearch, initialValue = "", compact = false }) {
  const [value, setValue] = useState(initialValue);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  const fetchSuggestions = useCallback((text) => {
    if (!text || !text.trim()) {
      setSuggestions([]);
      return;
    }
    getSuggestions(text, 6)
      .then((data) => setSuggestions(data.results || []))
      .catch(() => setSuggestions([]));
  }, []);

  function handleChange(e) {
    const text = e.target.value;
    setValue(text);
    setOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), DEBOUNCE_MS);
  }

  function handleSubmit(e) {
    e.preventDefault();
    setOpen(false);
    onSearch(value);
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
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit} className="w-full">
        <div className="relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            value={value}
            onChange={handleChange}
            onFocus={() => value && setOpen(true)}
            placeholder="Search any title..."
            className={`w-full rounded-lg bg-surface border border-border pl-10 pr-4 text-white placeholder-white/30
                       focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition
                       ${compact ? "py-2 text-sm" : "py-3.5 text-base"}`}
          />
        </div>
      </form>

      {open && (
        <SearchSuggestDropdown
          results={suggestions}
          query={value}
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
