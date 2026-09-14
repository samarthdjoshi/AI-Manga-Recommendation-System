import { useRef } from "react";
import { Link } from "react-router-dom";
import DiscoveryCard from "./DiscoveryCard";

export default function DiscoveryRail({
  title,
  icon,
  items = [],
  viewAllLink,
  loading = false,
  error = null,
}) {
  const scrollContainerRef = useRef(null);

  function scroll(direction) {
    if (!scrollContainerRef.current) return;
    const scrollAmount = direction === "left" ? -480 : 480;
    scrollContainerRef.current.scrollBy({
      left: scrollAmount,
      behavior: "smooth",
    });
  }

  return (
    <section className="space-y-4">
      {/* Rail Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-lg sm:text-xl">{icon}</span>}
          <h2 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight">
            {title}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {viewAllLink && (
            <Link
              to={viewAllLink}
              className="text-xs font-bold text-accent hover:text-accentHover transition-colors flex items-center gap-1 mr-2"
            >
              <span>View All</span>
              <span>→</span>
            </Link>
          )}

          {/* Rail Scroll Arrows */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              type="button"
              onClick={() => scroll("left")}
              className="p-1.5 rounded-lg border border-border bg-surface text-muted hover:text-foreground hover:bg-surfaceHover transition-colors"
              aria-label={`Scroll ${title} left`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              className="p-1.5 rounded-lg border border-border bg-surface text-muted hover:text-foreground hover:bg-surfaceHover transition-colors"
              aria-label={`Scroll ${title} right`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Rail Items Container */}
      {loading ? (
        <div className="flex gap-4 overflow-hidden py-1">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="flex-shrink-0 w-[160px] sm:w-[185px] rounded-2xl bg-surface border border-border overflow-hidden animate-pulse"
            >
              <div className="aspect-[2/3] bg-surfaceHover" />
              <div className="p-3 space-y-2">
                <div className="h-3.5 bg-surfaceHover rounded w-4/5" />
                <div className="h-2.5 bg-surfaceHover rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-surface border border-border text-center text-xs text-muted">
          Unable to load feed at this time. Please try refreshing.
        </div>
      ) : items.length === 0 ? (
        <div className="p-6 rounded-2xl bg-surface border border-border text-center text-xs text-muted">
          No titles found in this feed.
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth no-scrollbar"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {items.map((item, idx) => (
            <DiscoveryCard
              key={item.external_id || item.gold_id || idx}
              item={item}
              rank={idx + 1}
            />
          ))}
        </div>
      )}
    </section>
  );
}
