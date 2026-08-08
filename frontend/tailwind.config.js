/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0a0f",
        surface: "#15151b",
        surfaceHover: "#1c1c24",
        border: "#232330",
        accent: "#7c5cfc",
        accentHover: "#8f72ff",
        accentSoft: "#241c3d",
        teal: "#4fd1c5",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
