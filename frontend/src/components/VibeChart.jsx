import { useState, useMemo } from "react";

// Canonical mapping of Gold genres/tags to 6 atmospheric/tonal vibe dimensions
const VIBE_DEFINITIONS = [
  {
    id: "action",
    name: "Adrenaline & Action",
    shortName: "Action",
    color: "#f87171", // red-400
    colorFill: "rgba(248, 113, 113, 0.2)",
    tags: new Set([
      "action", "adventure", "sports", "martial arts", "mecha", "military",
      "survival", "super power", "racing", "delinquents", "boxing", "swordplay",
      "war", "guns", "assassins", "fugitive", "police", "ships", "battle royale"
    ]),
  },
  {
    id: "drama",
    name: "Drama & Depth",
    shortName: "Drama",
    color: "#a78bfa", // purple-400
    colorFill: "rgba(167, 139, 250, 0.2)",
    tags: new Set([
      "drama", "psychological", "tragedy", "philosophical", "philosophy",
      "coming of age", "historical", "family life", "politics", "award winning",
      "melodrama", "rehabilitation", "suicide", "found family", "disability",
      "religion", "cult", "amnesia", "adoption", "time skip"
    ]),
  },
  {
    id: "romance",
    name: "Romance & Heart",
    shortName: "Romance",
    color: "#f472b6", // pink-400
    colorFill: "rgba(244, 114, 182, 0.2)",
    tags: new Set([
      "romance", "shoujo", "josei", "boys' love", "girls' love", "shoujo ai",
      "shounen ai", "yuri", "yaoi", "heterosexual", "age gap", "tsundere",
      "female harem", "male harem", "love triangle", "marriage", "first love"
    ]),
  },
  {
    id: "wholesome",
    name: "Humor & Wholesome",
    shortName: "Humor",
    color: "#fbbf24", // amber-400
    colorFill: "rgba(251, 191, 36, 0.2)",
    tags: new Set([
      "comedy", "slice of life", "school life", "school", "iyashikei",
      "parody", "gag", "cute girls doing cute things", "cute boys doing cute things",
      "animals", "food", "cooking", "restaurant", "work", "office worker",
      "chibi", "moe"
    ]),
  },
  {
    id: "dark",
    name: "Suspense & Dark",
    shortName: "Suspense",
    color: "#38bdf8", // sky-400
    colorFill: "rgba(56, 189, 248, 0.2)",
    tags: new Set([
      "horror", "mystery", "thriller", "crime", "seinen", "gore", "dystopian",
      "post-apocalyptic", "monsters", "detective", "cosmic horror", "body horror",
      "torture", "noir", "conspiracy", "pandemic", "terrorism", "apocalypse"
    ]),
  },
  {
    id: "fantasy",
    name: "Wonder & Fantasy",
    shortName: "Fantasy",
    color: "#34d399", // emerald-400
    colorFill: "rgba(52, 211, 153, 0.2)",
    tags: new Set([
      "fantasy", "supernatural", "magic", "sci-fi", "isekai", "demons",
      "space", "time travel", "time manipulation", "mythology", "reincarnation",
      "dragons", "elf", "witch", "monsters", "gods", "robots", "cyberpunk",
      "steampunk", "virtual reality", "augmented reality", "alien"
    ]),
  },
];

export default function VibeChart({ genres = [] }) {
  const [activeAxis, setActiveAxis] = useState(null);

  // Compute exact mathematical mapping from real catalog genres
  const { dimensions, totalMatches, hasEnoughData } = useMemo(() => {
    if (!Array.isArray(genres) || genres.length === 0) {
      return { dimensions: [], totalMatches: 0, hasEnoughData: false };
    }

    let matchCount = 0;
    const mapped = VIBE_DEFINITIONS.map((def) => {
      // Find exact intersecting tags
      const matchingTags = [];
      for (const g of genres) {
        if (typeof g === "string" && def.tags.has(g.toLowerCase().trim())) {
          matchingTags.push(g);
        }
      }
      matchCount += matchingTags.length;
      return {
        ...def,
        matchingTags,
        count: matchingTags.length,
      };
    });

    if (matchCount === 0) {
      return { dimensions: [], totalMatches: 0, hasEnoughData: false };
    }

    // Normalized percentages and intensities
    const withPercentages = mapped.map((d) => {
      const percentage = Math.round((d.count / matchCount) * 100);
      const intensity = d.count / matchCount; // 0.0 to 1.0
      return { ...d, percentage, intensity };
    });

    return {
      dimensions: withPercentages,
      totalMatches: matchCount,
      hasEnoughData: true,
    };
  }, [genres]);

  // SVG Geometry for 6-axis Radar
  const size = 300;
  const center = size / 2;
  const radius = 95;
  const numAxes = VIBE_DEFINITIONS.length;

  // Max intensity among dimensions for scaling polygon dynamically
  const maxIntensity = useMemo(() => {
    if (!dimensions || dimensions.length === 0) return 1;
    const maxVal = Math.max(...dimensions.map((d) => d.intensity));
    return maxVal > 0 ? maxVal : 1;
  }, [dimensions]);

  // Calculate polygon vertices
  const polygonPoints = useMemo(() => {
    if (!hasEnoughData) return "";
    return dimensions
      .map((d, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / numAxes;
        // Scale relative to highest intensity for balanced visual appeal, with a 0 value placed at center
        const r = d.intensity > 0 ? (d.intensity / maxIntensity) * radius : 0;
        const x = center + r * Math.cos(angle);
        const y = center + r * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [dimensions, hasEnoughData, maxIntensity, center, radius, numAxes]);

  return (
    <div
      className="rounded-2xl bg-surface border border-border p-5 sm:p-6 relative overflow-hidden shadow-sm"
      aria-label="Vibe Chart atmospheric breakdown card"
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
            Vibe Profile
          </h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surfaceHover text-muted font-mono font-semibold">
            ATMOSPHERE
          </span>
        </div>
        {hasEnoughData && (
          <span className="text-[11px] text-muted">
            {totalMatches} matching tag{totalMatches !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {hasEnoughData ? (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-6 items-center">
          {/* SVG Radar Chart */}
          <div className="flex flex-col items-center justify-center relative">
            <svg
              className="w-full max-w-[280px] sm:max-w-[300px] aspect-square overflow-visible select-none"
              viewBox={`0 0 ${size} ${size}`}
              role="img"
              aria-label="Radar chart showing atmospheric distribution across 6 dimensions"
            >
              {/* Concentric Guide Polygons */}
              {[0.25, 0.5, 0.75, 1].map((scale) => {
                const ringPoints = Array.from({ length: numAxes })
                  .map((_, i) => {
                    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / numAxes;
                    const r = radius * scale;
                    const x = center + r * Math.cos(angle);
                    const y = center + r * Math.sin(angle);
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(" ");
                return (
                  <polygon
                    key={scale}
                    points={ringPoints}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth="1"
                    strokeDasharray={scale === 1 ? "none" : "2,2"}
                  />
                );
              })}

              {/* Axis Spokes */}
              {Array.from({ length: numAxes }).map((_, i) => {
                const angle = -Math.PI / 2 + (i * 2 * Math.PI) / numAxes;
                const x2 = center + radius * Math.cos(angle);
                const y2 = center + radius * Math.sin(angle);
                return (
                  <line
                    key={i}
                    x1={center}
                    y1={center}
                    x2={x2}
                    y2={y2}
                    stroke="var(--border)"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Data Polygon Fill & Stroke */}
              {polygonPoints && (
                <polygon
                  points={polygonPoints}
                  fill="var(--accent-soft)"
                  stroke="var(--accent)"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  style={{ transition: "all 0.4s ease" }}
                />
              )}

              {/* Data Point Nodes and Interactive Labels */}
              {dimensions.map((d, i) => {
                const angle = -Math.PI / 2 + (i * 2 * Math.PI) / numAxes;
                const r = d.intensity > 0 ? (d.intensity / maxIntensity) * radius : 0;
                const x = center + r * Math.cos(angle);
                const y = center + r * Math.sin(angle);

                // Label position slightly outside radius
                const labelR = radius + 24;
                const lx = center + labelR * Math.cos(angle);
                const ly = center + labelR * Math.sin(angle);

                const isActive = activeAxis === d.id;

                return (
                  <g
                    key={d.id}
                    className="cursor-pointer transition-opacity"
                    onMouseEnter={() => setActiveAxis(d.id)}
                    onMouseLeave={() => setActiveAxis(null)}
                    onClick={() => setActiveAxis(isActive ? null : d.id)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${d.name}: ${d.percentage}%`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setActiveAxis(isActive ? null : d.id);
                      }
                    }}
                  >
                    {/* Node Dot */}
                    <circle
                      cx={x}
                      cy={y}
                      r={isActive ? 6 : 4}
                      fill={d.color}
                      stroke="var(--bg-surface)"
                      strokeWidth="2"
                    />

                    {/* Axis Label */}
                    <text
                      x={lx}
                      y={ly}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="var(--text-primary)"
                      className={`text-[11px] font-medium select-none transition-colors ${
                        isActive ? "font-black opacity-100" : "opacity-75 hover:opacity-100 font-semibold"
                      }`}
                    >
                      {d.shortName}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Active Axis Tooltip / Helper */}
            <div className="min-h-[28px] mt-2 text-center text-xs">
              {activeAxis ? (
                (() => {
                  const current = dimensions.find((d) => d.id === activeAxis);
                  if (!current) return null;
                  return (
                    <span className="text-foreground font-medium animate-fadeIn">
                      <strong style={{ color: current.color }}>{current.name}:</strong>{" "}
                      {current.percentage}% ({current.count} tag{current.count !== 1 ? "s" : ""})
                    </span>
                  );
                })()
              ) : (
                <span className="text-muted">
                  Click or hover any axis for contributing genre tags
                </span>
              )}
            </div>
          </div>

          {/* Dimensional Breakdown List */}
          <div className="space-y-2.5">
            {dimensions.map((d) => {
              const isActive = activeAxis === d.id;
              return (
                <div
                  key={d.id}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isActive
                      ? "bg-accentSoft border-accent shadow-sm"
                      : "bg-surfaceHover/60 border-border hover:border-accent/40"
                  }`}
                  onClick={() => setActiveAxis(isActive ? null : d.id)}
                  onMouseEnter={() => setActiveAxis(d.id)}
                  onMouseLeave={() => setActiveAxis(null)}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: d.color }}
                      />
                      {d.name}
                    </span>
                    <span className="font-mono text-muted">{d.percentage}%</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-surfaceHover rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${d.percentage}%`,
                        backgroundColor: d.color,
                      }}
                    />
                  </div>

                  {/* Contributing tags chips when expanded or non-zero */}
                  {d.matchingTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {d.matchingTags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-surfaceHover text-muted"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Honest Insufficient Data State */
        <div className="py-6 text-center">
          <div className="w-12 h-12 mx-auto mb-2.5 rounded-full bg-surfaceHover border border-dashed border-border flex items-center justify-center text-muted">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-foreground mb-1">
            Insufficient genre data for vibe profile
          </p>
          <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
            This title has fewer than the required indexed genre tags to construct a mathematically sound atmospheric distribution.
          </p>
        </div>
      )}
    </div>
  );
}
