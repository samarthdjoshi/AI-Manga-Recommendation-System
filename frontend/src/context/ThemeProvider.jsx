import { useState, useEffect, useCallback, useMemo } from "react";
import { ThemeContext } from "./theme-context";
import { THEMES, DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME } from "./theme-constants";

export function ThemeProvider({ children }) {
  const [appearance, setAppearanceState] = useState(() => {
    try {
      return localStorage.getItem("manga_appearance") || "system";
    } catch {
      return "system";
    }
  });

  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem("manga_theme") || DEFAULT_DARK_THEME;
    } catch {
      return DEFAULT_DARK_THEME;
    }
  });

  const [isSystemDark, setIsSystemDark] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  // Track system appearance changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setIsSystemDark(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Compute effective appearance and theme
  const effectiveMode = appearance === "system" ? (isSystemDark ? "dark" : "light") : appearance;

  const resolvedTheme = useMemo(() => {
    const matched = THEMES.find((t) => t.id === theme);
    if (!matched) return effectiveMode === "light" ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME;

    // If active theme type doesn't match effective mode, return appropriate default
    if (matched.type !== effectiveMode) {
      return effectiveMode === "light" ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME;
    }
    return theme;
  }, [theme, effectiveMode]);

  // Apply resolved theme to document root
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  const setAppearance = useCallback((newAppearance) => {
    setAppearanceState(newAppearance);
    try {
      localStorage.setItem("manga_appearance", newAppearance);
    } catch {
      // ignore
    }
  }, []);

  const setTheme = useCallback((newThemeId) => {
    const matched = THEMES.find((t) => t.id === newThemeId);
    if (matched) {
      setThemeState(newThemeId);
      if (matched.type !== appearance && appearance !== "system") {
        setAppearanceState(matched.type);
        try {
          localStorage.setItem("manga_appearance", matched.type);
        } catch {
          // ignore
        }
      }
      try {
        localStorage.setItem("manga_theme", newThemeId);
      } catch {
        // ignore
      }
    }
  }, [appearance]);

  const openThemeModal = useCallback(() => setIsThemeModalOpen(true), []);
  const closeThemeModal = useCallback(() => setIsThemeModalOpen(false), []);

  const value = useMemo(
    () => ({
      appearance,
      setAppearance,
      theme,
      setTheme,
      resolvedTheme,
      isDark: effectiveMode === "dark",
      availableThemes: THEMES,
      isThemeModalOpen,
      openThemeModal,
      closeThemeModal,
    }),
    [
      appearance,
      setAppearance,
      theme,
      setTheme,
      resolvedTheme,
      effectiveMode,
      isThemeModalOpen,
      openThemeModal,
      closeThemeModal,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
