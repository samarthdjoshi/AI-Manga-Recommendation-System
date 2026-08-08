import { Link } from "react-router-dom";
import SearchBar from "./SearchBar";
import { useNavigate } from "react-router-dom";

export default function Header() {
  const navigate = useNavigate();

  function handleSearch(query) {
    if (query && query.trim()) {
      navigate(`/browse?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-ink/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-6 py-3 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center font-extrabold text-white text-lg">
            M
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white leading-none">
              Mangalyst
            </h1>
            <p className="text-[11px] text-white/35 leading-none mt-0.5">
              manga · manhwa · manhua recommendations
            </p>
          </div>
        </Link>

        <div className="flex-1 max-w-xl">
          <SearchBar onSearch={handleSearch} compact />
        </div>

        <Link
          to="/browse"
          className="shrink-0 rounded-lg border border-border px-4 py-2 text-sm font-medium text-white/70
                     hover:text-white hover:border-accent/50 transition"
        >
          Browse
        </Link>
      </div>
    </header>
  );
}
