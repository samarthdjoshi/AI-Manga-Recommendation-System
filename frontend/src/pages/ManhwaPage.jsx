import { useState, useEffect } from "react";
import DiscoveryCard from "../components/DiscoveryCard";
import LoadingSpinner from "../components/LoadingSpinner";
import { getPopularManhwa } from "../api/client";

export default function ManhwaPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = ["All", "Action", "Romance", "Fantasy", "Drama", "Comedy"];

  useEffect(() => {
    let cancelled = false;

    getPopularManhwa(50, 1)
      .then((res) => {
        if (!cancelled) {
          setItems(res.results || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load Korean manhwa feed. Please try again.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = items.filter((item) => {
    if (activeCategory === "All") return true;
    return (item.genres || []).some(
      (g) => g.toLowerCase() === activeCategory.toLowerCase()
    );
  });

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-bold mb-2">
            <span>🇰🇷</span>
            <span>Korean Webtoon & Manhwa Hub</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            Popular Manhwa & Webtoons
          </h1>
          <p className="text-sm text-muted mt-1">
            Explore the world's most popular full-color Korean webtoons, regression action, romance fantasy, and dungeon hunters.
          </p>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition shadow-sm ${
                activeCategory === cat
                  ? "bg-accentSoft border-accent text-accent"
                  : "bg-surface border-border text-foreground hover:bg-surfaceHover"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-24">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl bg-surface border border-border text-center text-sm text-rose-400">
          {error}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-surface border border-border">
          <p className="text-sm font-bold text-foreground">No manhwa found for category "{activeCategory}".</p>
          <button
            type="button"
            onClick={() => setActiveCategory("All")}
            className="mt-3 text-xs font-semibold text-accent hover:underline"
          >
            Show All Manhwa
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-5 xl:gap-6">
          {filteredItems.map((item, idx) => (
            <DiscoveryCard
              key={item.external_id || item.gold_id || idx}
              item={item}
              rank={idx + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
