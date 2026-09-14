import { useState, useRef, useEffect } from "react";

export default function MultiSelectDropdown({
  label,
  value, // string value or null
  options = [],
  onChange,
  className = "",
  compact = false,
  placeholder = "Any",
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = options.find((o) => o.value === value) || null;

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape" && open) {
        setOpen(false);
        containerRef.current?.querySelector("button")?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleToggle(val) {
    // If clicking the currently selected value, unselect it (revert to "")
    if (value === val) {
      onChange("");
    } else {
      onChange(val);
    }
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
          {label}
        </span>
      )}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 rounded-xl bg-ink border border-border text-foreground font-medium transition-all duration-200 hover:border-accent/60 hover:bg-surfaceHover focus:outline-none focus:ring-1 focus:ring-accent ${
          compact ? "px-2.5 py-1.5 text-xs min-h-[36px]" : "px-3.5 py-2.5 text-sm min-h-[44px]"
        }`}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`h-4 w-4 text-muted transition-transform duration-200 shrink-0 ${
            open ? "rotate-180 text-accent" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[170px] max-h-60 overflow-y-auto rounded-xl bg-surface border border-border shadow-2xl py-1 z-40 animate-fadeIn">
          {options.map((opt) => {
            const isSelected = value === opt.value || (!value && !opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleToggle(opt.value)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors hover:bg-surfaceHover ${
                  isSelected
                    ? "bg-accentSoft text-accent font-semibold"
                    : "text-foreground"
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <svg className="h-3.5 w-3.5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
