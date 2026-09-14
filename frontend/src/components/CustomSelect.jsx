import { useState, useRef, useEffect } from "react";

export default function CustomSelect({
  label,
  value,
  options = [],
  onChange,
  className = "",
  compact = false,
  icon,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const listboxRef = useRef(null);

  const selectedOption = options.find((opt) => String(opt.value) === String(value)) || options[0];

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

  function handleSelect(val) {
    onChange(val);
    setOpen(false);
    containerRef.current?.querySelector("button")?.focus();
  }

  function handleTriggerKeyDown(e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setTimeout(() => {
        const first = listboxRef.current?.querySelector('[role="option"]');
        first?.focus();
      }, 50);
    }
  }

  function handleOptionKeyDown(e, val) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect(val);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = e.currentTarget.nextElementSibling;
      if (next) next.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = e.currentTarget.previousElementSibling;
      if (prev) prev.focus();
    }
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
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 rounded-xl bg-ink border border-border text-foreground font-medium transition-all duration-200 hover:border-accent/60 hover:bg-surfaceHover focus:outline-none focus:ring-1 focus:ring-accent ${
          compact ? "px-2.5 py-1.5 text-xs min-h-[36px]" : "px-3.5 py-2.5 text-sm min-h-[44px]"
        }`}
      >
        <span className="flex items-center gap-1.5 truncate">
          {icon && <span className="text-muted shrink-0">{icon}</span>}
          <span className="truncate">{selectedOption ? selectedOption.label : "Select..."}</span>
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
        <div
          ref={listboxRef}
          role="listbox"
          aria-label={label || "Options"}
          className="absolute left-0 top-full mt-1.5 w-full min-w-[160px] max-h-60 overflow-y-auto rounded-xl bg-surface border border-border shadow-2xl py-1 z-40 animate-fadeIn focus:outline-none"
        >
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <div
                key={opt.value}
                role="option"
                tabIndex={0}
                aria-selected={isSelected}
                onClick={() => handleSelect(opt.value)}
                onKeyDown={(e) => handleOptionKeyDown(e, opt.value)}
                className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors focus:outline-none focus:bg-surfaceHover ${
                  isSelected
                    ? "bg-accentSoft text-accent font-semibold"
                    : "text-foreground hover:bg-surfaceHover hover:text-accent"
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  {opt.icon && <span>{opt.icon}</span>}
                  <span>{opt.label}</span>
                </span>
                {isSelected && (
                  <svg className="h-3.5 w-3.5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
