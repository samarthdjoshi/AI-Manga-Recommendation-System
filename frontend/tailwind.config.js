/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--bg-base)",
        background: "var(--bg-base)",
        surface: "var(--bg-surface)",
        "surface-elevated": "var(--bg-surface-elevated)",
        "surface-muted": "var(--bg-surface-muted)",
        surfaceHover: "var(--bg-surface-elevated)",
        surfaceMuted: "var(--bg-surface-muted)",
        card: "var(--bg-surface)",
        "card-hover": "var(--bg-surface-elevated)",
        border: "var(--border)",
        borderSubtle: "var(--border-subtle)",
        accent: "var(--accent)",
        accentHover: "var(--accent-hover)",
        accentSoft: "var(--accent-soft)",
        accentFg: "var(--accent-foreground)",
        primary: "var(--accent)",
        secondary: "var(--teal)",
        foreground: "var(--text-primary)",
        textSecondary: "var(--text-secondary)",
        muted: "var(--text-muted)",
        teal: "var(--teal)",
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#f43f5e",
      },
      boxShadow: {
        themeCard: "var(--card-shadow)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
