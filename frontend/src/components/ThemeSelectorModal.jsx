import { useEffect } from "react";
import { useTheme } from "../context/useTheme";

export default function ThemeSelectorModal() {
  const {
    appearance,
    setAppearance,
    setTheme,
    resolvedTheme,
    availableThemes,
    isThemeModalOpen,
    closeThemeModal,
  } = useTheme();

  // Close on Escape key
  useEffect(() => {
    if (!isThemeModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") closeThemeModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isThemeModalOpen, closeThemeModal]);

  if (!isThemeModalOpen) return null;

  const lightThemes = availableThemes.filter((t) => t.type === "light");
  const darkThemes = availableThemes.filter((t) => t.type === "dark");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeThemeModal();
      }}
    >
      <div className="w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl p-4 sm:p-8 max-h-[90vh] overflow-y-auto overflow-x-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border mb-5 sm:mb-6">
          <div>
            <h2 id="theme-modal-title" className="text-lg sm:text-xl font-bold text-foreground">
              Visual Themes & Appearance
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Personalize your discovery atmosphere with curated light and dark aesthetic palettes.
            </p>
          </div>
          <button
            type="button"
            onClick={closeThemeModal}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surfaceHover transition-colors shrink-0"
            aria-label="Close theme selector"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Appearance Mode Selector */}
        <div className="mb-6">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted mb-2.5 block">
            Appearance Mode
          </label>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
            {[
              { id: "dark", label: "Dark", fullLabel: "Dark Mode", icon: "🌙" },
              { id: "light", label: "Light", fullLabel: "Light Mode", icon: "☀️" },
              { id: "system", label: "System", fullLabel: "System Sync", icon: "💻" },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setAppearance(mode.id)}
                className={`py-2 sm:py-2.5 px-1.5 sm:px-3 rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-2 transition-all ${
                  appearance === mode.id
                    ? "bg-accent text-accentFg border-accent shadow-md"
                    : "bg-surfaceHover text-foreground border-border hover:border-accent/40"
                }`}
              >
                <span>{mode.icon}</span>
                <span className="sm:hidden truncate">{mode.label}</span>
                <span className="hidden sm:inline">{mode.fullLabel}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Theme Palettes Grid */}
        <div className="space-y-6">
          {/* Dark Themes */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Dark Palettes
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-accentSoft text-accent font-medium">
                {darkThemes.length} themes
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {darkThemes.map((item) => {
                const isSelected = resolvedTheme === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTheme(item.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden group ${
                      isSelected
                        ? "border-accent ring-2 ring-accent/30 bg-surfaceHover shadow-md"
                        : "border-border bg-surfaceHover/50 hover:border-accent/40 hover:bg-surfaceHover"
                    }`}
                  >
                    {/* Visual Swatch Strip */}
                    <div
                      className="h-10 rounded-lg p-2 flex items-center justify-between mb-3 border"
                      style={{
                        backgroundColor: item.preview.bg,
                        borderColor: item.preview.border,
                      }}
                    >
                      <div
                        className="px-2 py-1 rounded text-[11px] font-bold"
                        style={{
                          backgroundColor: item.preview.surface,
                          color: item.preview.text,
                        }}
                      >
                        Aa
                      </div>
                      <div
                        className="w-5 h-5 rounded-full shadow-sm"
                        style={{ backgroundColor: item.preview.accent }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">
                        {item.name}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent text-accentFg">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted mt-1 line-clamp-1">
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Light Themes */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Light Palettes
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-accentSoft text-accent font-medium">
                {lightThemes.length} themes
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {lightThemes.map((item) => {
                const isSelected = resolvedTheme === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTheme(item.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden group ${
                      isSelected
                        ? "border-accent ring-2 ring-accent/30 bg-surfaceHover shadow-md"
                        : "border-border bg-surfaceHover/50 hover:border-accent/40 hover:bg-surfaceHover"
                    }`}
                  >
                    {/* Visual Swatch Strip */}
                    <div
                      className="h-10 rounded-lg p-2 flex items-center justify-between mb-3 border"
                      style={{
                        backgroundColor: item.preview.bg,
                        borderColor: item.preview.border,
                      }}
                    >
                      <div
                        className="px-2 py-1 rounded text-[11px] font-bold border"
                        style={{
                          backgroundColor: item.preview.surface,
                          color: item.preview.text,
                          borderColor: item.preview.border,
                        }}
                      >
                        Aa
                      </div>
                      <div
                        className="w-5 h-5 rounded-full shadow-sm"
                        style={{ backgroundColor: item.preview.accent }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">
                        {item.name}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent text-accentFg">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted mt-1 line-clamp-1">
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={closeThemeModal}
            className="px-5 py-2 rounded-xl bg-accent text-accentFg font-semibold text-xs hover:bg-accentHover transition-colors shadow-sm"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
}
