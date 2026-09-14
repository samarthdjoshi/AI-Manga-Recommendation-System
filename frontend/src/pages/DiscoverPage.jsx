import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import DiscoveryCard from "../components/DiscoveryCard";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  getTrendingManga,
  getPopularManga,
  getTop100Manga,
  getPopularManhwa,
} from "../api/client";

const TABS = [
  { id: "trending", label: "🔥 Trending Now", fetcher: getTrendingManga },
  { id: "popular", label: "⭐ Popular All-Time", fetcher: getPopularManga },
  { id: "top", label: "🏆 Top Ranked", fetcher: (limit, page) => getTop100Manga(50, page) },
  { id: "manhwa", label: "🇰🇷 Korean Manhwa", fetcher: getPopularManhwa },
];

export default function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabId = searchParams.get("tab") || "trending";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const activeTab = TABS.find((t) => t.id === activeTabId) || TABS[0];

  function handleTabChange(tabId) {
    setSearchParams({ tab: tabId });
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;

    activeTab.fetcher(30, 1)
      .then((res) => {
        if (!cancelled) {
          setItems(res.results || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load discovery feed. Please try again.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  return (
    <div className="space-y-8 pb-16">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
          Live Internet Discovery
        </h1>
        <p className="text-sm text-muted mt-1">
          Explore real-time trending titles, all-time popularity leaderboards, and curated webtoon feeds.
        </p>
      </div>

      {/* Tab Selector */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-4">
        {TABS.map((tab) => {
          const isSelected = activeTab.id === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isSelected
                  ? "bg-accent text-accentFg shadow-sm"
                  : "bg-surfaceHover text-muted hover:text-foreground hover:bg-surfaceHover/80"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Feed Content */}
      {loading ? (
        <div className="py-20">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl bg-surface border border-border text-center text-sm text-rose-400">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="p-8 rounded-2xl bg-surface border border-border text-center text-sm text-muted">
          No titles found in this feed.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {items.map((item, idx) => (
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
