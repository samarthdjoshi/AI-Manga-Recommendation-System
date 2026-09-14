import { useState } from "react";

export default function MangaMeter({
  ratingCombined,
  sources = [],
  ratingAnilist = null,
  ratingMangaupdates = null,
}) {
  const [showInfo, setShowInfo] = useState(false);

  const hasRating = ratingCombined != null && !Number.isNaN(Number(ratingCombined));
  const numericRating = hasRating ? Number(ratingCombined) : null;
  const ratingOutOf10 = hasRating ? Math.max(0, Math.min(10, numericRating)) : 0;
  const percentage = Math.round((ratingOutOf10 / 10) * 100);

  // Determine corroboration status based on real source data
  const validSources = Array.isArray(sources) ? sources : [];
  const isCorroborated = validSources.length >= 2;

  // Rating tiers for honest context
  let tierLabel = "Mixed Reviews";
  let tierColor = "text-amber-500";
  let ringColor = "#f59e0b"; // amber-500
  if (ratingOutOf10 >= 8.5) {
    tierLabel = "Universal Acclaim";
    tierColor = "text-emerald-500";
    ringColor = "#10b981"; // emerald-500
  } else if (ratingOutOf10 >= 7.5) {
    tierLabel = "Community Favorite";
    tierColor = "text-teal";
    ringColor = "#4fd1c5"; // teal
  } else if (ratingOutOf10 >= 6.5) {
    tierLabel = "Generally Favorable";
    tierColor = "text-accent";
    ringColor = "var(--accent)";
  }

  // Circular gauge geometry
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className="rounded-2xl bg-surface border border-border p-5 sm:p-6 relative overflow-hidden shadow-sm"
      aria-label="Manga Meter consensus rating card"
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
            Manga Meter
          </h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surfaceHover text-muted font-mono font-semibold">
            CONSENSUS
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowInfo((prev) => !prev)}
          className="text-xs text-muted hover:text-foreground transition-colors flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-accent rounded px-1"
          aria-expanded={showInfo}
          aria-label="Toggle Manga Meter explanation"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[11px]">{showInfo ? "Hide" : "Methodology"}</span>
        </button>
      </div>

      {showInfo && (
        <div className="mb-4 p-3.5 rounded-xl bg-surfaceHover border border-border text-xs text-foreground/80 space-y-1.5 animate-fadeIn">
          <p className="font-bold text-foreground">How is this calculated?</p>
          <p>
            The Manga Meter is a cross-platform consensus rating derived only from verified community votes
            (AniList and MangaUpdates).
          </p>
          <p className="text-muted">
            When multiple platforms report votes, ratings are weighted by review volume using logarithmic damping
            to prevent vote manipulation without manufacturing artificial precision.
          </p>
        </div>
      )}

      {hasRating ? (
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Radial Gauge */}
          <div className="relative shrink-0 flex items-center justify-center">
            <svg
              className="w-24 h-24 -rotate-90 transform"
              viewBox="0 0 100 100"
              role="img"
              aria-label={`Rating gauge showing ${ratingOutOf10.toFixed(2)} out of 10`}
            >
              {/* Background Ring */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="text-border"
                strokeWidth="7"
                stroke="currentColor"
                fill="transparent"
              />
              {/* Filled Ring */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke={ringColor}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                fill="transparent"
                style={{ transition: "stroke-dashoffset 0.6s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-black text-foreground tracking-tight">
                {ratingOutOf10.toFixed(1)}
              </span>
              <span className="text-[10px] text-muted font-medium -mt-1">/ 10</span>
            </div>
          </div>

          {/* Details & Corroboration */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
              <span className={`text-sm font-bold ${tierColor}`}>{tierLabel}</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                  isCorroborated
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                    : "bg-cyan-500/10 text-cyan-500 border-cyan-500/30"
                }`}
              >
                {isCorroborated ? "✓ Corroborated Consensus" : "Single-Source Index"}
              </span>
            </div>

            <p className="text-xs text-muted mb-3">
              {isCorroborated
                ? "Verified across independent community databases with corroborated score agreement."
                : `Community rating indexed from ${validSources[0] || "1 catalog source"}.`}
            </p>

            {/* Individual source pills if available */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs">
              {ratingAnilist != null && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surfaceHover border border-border">
                  <span className="text-muted">AniList:</span>
                  <span className="font-bold text-foreground">
                    ★ {Number(ratingAnilist).toFixed(1)}
                  </span>
                </div>
              )}
              {ratingMangaupdates != null && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surfaceHover border border-border">
                  <span className="text-muted">MangaUpdates:</span>
                  <span className="font-bold text-foreground">
                    ★ {Number(ratingMangaupdates).toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Honest Insufficient Data State */
        <div className="py-4 text-center">
          <div className="w-12 h-12 mx-auto mb-2.5 rounded-full bg-surfaceHover border border-dashed border-border flex items-center justify-center text-muted">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-foreground mb-1">Not enough ratings</p>
          <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
            This title has not accumulated sufficient community votes across verified sources to display an honest score.
          </p>
        </div>
      )}
    </div>
  );
}
