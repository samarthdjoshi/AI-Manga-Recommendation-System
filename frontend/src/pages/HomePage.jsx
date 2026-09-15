import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import DiscoveryRail from "../components/DiscoveryRail";
import MangaGrid from "../components/MangaGrid";
import ContinueReadingShelf from "../components/ContinueReadingShelf";
import ActivityFeed from "../components/ActivityFeed";
import {
  getTrendingManga,
  getPopularManga,
  getPopularManhwa,
  getDiscover,
  getRecommendationsForMe,
  getMyProfile,
} from "../api/client";
import { useAuth } from "../context/useAuth";

export default function HomePage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [trending, setTrending] = useState([]);
  const [popular, setPopular] = useState([]);
  const [manhwa, setManhwa] = useState([]);
  const [corroborated, setCorroborated] = useState([]);
  const [forYou, setForYou] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const spotlight = trending && trending.length > 0 ? trending[0] : null;

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    getMyProfile(token)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [token]);

  function handleSearch(query) {
    if (query && query.trim()) {
      navigate(`/browse?q=${encodeURIComponent(query.trim())}`);
    }
  }

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      getTrendingManga(15, 1),
      getPopularManga(15, 1),
      getPopularManhwa(15, 1),
      getDiscover("corroborated", 12),
    ]).then(([trendingRes, popularRes, manhwaRes, corroRes]) => {
      if (cancelled) return;

      if (trendingRes.status === "fulfilled" && trendingRes.value?.results) {
        setTrending(trendingRes.value.results);
      }
      if (popularRes.status === "fulfilled" && popularRes.value?.results) {
        setPopular(popularRes.value.results);
      }
      if (manhwaRes.status === "fulfilled" && manhwaRes.value?.results) {
        setManhwa(manhwaRes.value.results);
      }
      if (corroRes.status === "fulfilled" && corroRes.value?.results) {
        setCorroborated(corroRes.value.results);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch recommendations (personalized if logged in, catalog-wide if guest)
  useEffect(() => {
    let cancelled = false;
    getRecommendationsForMe(token, 10)
      .then((data) => {
        if (!cancelled) setForYou(data.results || []);
      })
      .catch(() => {
        if (!cancelled) setForYou([]);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Spotlight title is the #1 trending title
  return (
    <div className="space-y-12 pb-16">
      {/* 1. Hero Section */}
      {user ? (
        /* Authenticated User Welcome Hero */
        <section className="relative rounded-3xl overflow-hidden border border-border bg-gradient-to-r from-surface via-surface-elevated to-surface p-6 sm:p-8 shadow-themeCard">
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/15 text-accent text-xs font-extrabold px-3 py-1 border border-accent/30">
                <span>👋</span>
                <span>Welcome back, {user.username}!</span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight">
                Your Mangaverse Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-muted max-w-xl">
                Track your active reading chapters, explore real-time trending releases, and connect with fellow readers.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                to={`/user/${user.username}/mangalist`}
                className="px-5 py-2.5 rounded-xl bg-accent text-white font-bold text-xs sm:text-sm shadow-md shadow-accent/25 hover:bg-accentHover transition"
              >
                Open Manga List &rarr;
              </Link>
              <Link
                to="/browse"
                className="px-4 py-2.5 rounded-xl bg-surface border border-border text-foreground font-bold text-xs sm:text-sm hover:border-accent/40 transition"
              >
                Browse All 339k+
              </Link>
            </div>
          </div>
        </section>
      ) : (
        /* Guest Discovery Hero */
        <section className="relative rounded-3xl overflow-hidden border border-border bg-gradient-to-b from-surface via-surface-elevated/40 to-ink p-5 sm:p-12 shadow-themeCard">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-accent/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-4xl mx-auto text-center space-y-4 sm:space-y-6">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-accent/15 text-accent text-[11px] sm:text-xs font-extrabold px-3 sm:px-4 py-1 sm:py-1.5 border border-accent/25 shadow-sm max-w-full truncate">
              <span>✨</span>
              <span className="truncate">Unified Manga Discovery · 339k+ Verified Records</span>
            </div>

            <h1 className="text-2xl sm:text-5xl md:text-6xl font-black text-foreground tracking-tight leading-tight">
              Explore the Next Universe in{" "}
              <span className="text-accent underline decoration-accent/30 decoration-wavy underline-offset-4 sm:underline-offset-8">
                Manga & Manhwa
              </span>
            </h1>

            <p className="text-muted text-xs sm:text-base max-w-xl mx-auto leading-relaxed">
              Real-time trending charts, curated community ratings, private library tracking, and AI vibe recommendations.
            </p>

            <div className="max-w-xl mx-auto pt-1 sm:pt-2">
              <SearchBar onSearch={handleSearch} />
            </div>

            {/* Quick Tag Pills */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 pt-1 text-[11px] sm:text-xs">
              <span className="text-muted font-bold hidden sm:inline">Trending searches:</span>
              {["Solo Leveling", "Chainsaw Man", "Omniscient Reader", "One Piece", "Berserk", "Tower of God"].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleSearch(tag)}
                  className="px-2.5 sm:px-3 py-1 rounded-xl bg-surfaceHover border border-border text-foreground hover:border-accent hover:text-accent font-semibold transition"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 2. Continue Reading Shelf (Authenticated) */}
      {token && <ContinueReadingShelf token={token} />}

      {/* 3. Featured Spotlight Card (If available and Guest) */}
      {!token && spotlight && (
        <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8 relative overflow-hidden group shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-center relative z-10">
            {spotlight.cover_url && (
              <div className="aspect-[2/3] w-36 sm:w-48 mx-auto rounded-2xl overflow-hidden border border-border shadow-xl">
                <img
                  src={spotlight.cover_url}
                  alt={spotlight.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            )}
            <div className="space-y-3 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 uppercase tracking-wider">
                  🔥 #1 Trending Today
                </span>
                {spotlight.score && (
                  <span className="text-xs font-bold text-emerald-400 bg-black/50 px-2.5 py-0.5 rounded-md">
                    ★ {spotlight.score}
                  </span>
                )}
                <span className="text-xs text-muted uppercase font-bold">
                  {spotlight.type || "MANGA"}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground">
                {spotlight.title}
              </h2>

              {spotlight.description && (
                <p className="text-muted text-xs sm:text-sm line-clamp-3 leading-relaxed max-w-2xl">
                  {spotlight.description}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
                <Link
                  to={spotlight.gold_id ? `/manga/${encodeURIComponent(spotlight.gold_id)}` : `/browse?q=${encodeURIComponent(spotlight.title)}`}
                  className="px-5 py-2.5 rounded-xl bg-accent text-white text-xs sm:text-sm font-bold hover:bg-accentHover transition-colors shadow-md flex items-center gap-1.5"
                >
                  <span>Explore Title</span>
                  <span>&rarr;</span>
                </Link>
                <Link
                  to="/top-100"
                  className="px-4 py-2.5 rounded-xl border border-border bg-surfaceHover text-foreground text-xs sm:text-sm font-bold hover:border-accent transition-colors"
                >
                  View Top 100 Leaderboard
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. Discovery Rail: Trending Now */}
      <DiscoveryRail
        title="Trending Manga & Manhwa"
        icon="🔥"
        items={trending}
        viewAllLink="/trending"
        loading={loading}
      />

      {/* 5. Discovery Rail: All-Time Popular */}
      <DiscoveryRail
        title="All-Time Top Ranked Titles"
        icon="🏆"
        items={popular}
        viewAllLink="/top-100"
        loading={loading}
      />

      {/* 6. Discovery Rail: Popular Manhwa & Webtoons */}
      <DiscoveryRail
        title="Popular Korean Manhwa & Webtoons"
        icon="⚡"
        items={manhwa}
        viewAllLink="/manhwa"
        loading={loading}
      />

      {/* 7. Community Activity & Personalized Recommendations (2-Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4 border-t border-border">
        {/* Main 2-Span Column: Community Activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">💬</span>
              <div>
                <h2 className="text-xl font-extrabold text-foreground tracking-tight">
                  Community Activity Feed
                </h2>
                <p className="text-xs text-muted">See what readers are sharing and discussing</p>
              </div>
            </div>
          </div>
          <ActivityFeed initialFeed={token ? "following" : "global"} />
        </div>

        {/* Right Sidebar Column */}
        <div className="space-y-6">
          {/* User Mini Card if Authenticated */}
          {user && (
            <div className="bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-accent text-white overflow-hidden shrink-0 flex items-center justify-center font-bold text-xl shadow-sm">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                  ) : (
                    user.username ? user.username[0].toUpperCase() : "U"
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/user/${user.username}`}
                    className="font-bold text-base text-foreground hover:text-accent transition block truncate"
                  >
                    {user.username}
                  </Link>
                  <div className="text-xs text-muted mt-0.5 flex items-center gap-2">
                    <span>{profile?.followers_count || 0} Followers</span>
                    <span>•</span>
                    <span>{profile?.following_count || 0} Following</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/70">
                <Link
                  to={`/user/${user.username}/mangalist`}
                  className="p-3 rounded-xl bg-surfaceHover hover:bg-surfaceHover/80 border border-border text-center transition"
                >
                  <div className="text-xs font-bold text-foreground">Manga List</div>
                  <div className="text-[11px] text-muted">View tracker</div>
                </Link>
                <Link
                  to="/settings"
                  className="p-3 rounded-xl bg-surfaceHover hover:bg-surfaceHover/80 border border-border text-center transition"
                >
                  <div className="text-xs font-bold text-foreground">Settings</div>
                  <div className="text-[11px] text-muted">Account & lists</div>
                </Link>
              </div>
            </div>
          )}

          {/* Recommendations Sidebar Section */}
          {forYou.length > 0 && (
            <div className="bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <span>✨</span>
                  <span>Recommended For You</span>
                </h3>
                <Link to="/recommendations" className="text-xs font-bold text-accent hover:underline">
                  View All &rarr;
                </Link>
              </div>
              <div className="divide-y divide-border">
                {forYou.slice(0, 5).map((item) => (
                  <Link
                    key={item.gold_id}
                    to={`/manga/${encodeURIComponent(item.gold_id)}`}
                    className="py-2.5 flex items-center gap-3 hover:bg-surfaceHover/60 px-1 rounded-xl transition group"
                  >
                    <div className="w-10 h-14 rounded-lg overflow-hidden bg-slate-900 shrink-0 border border-border/60 relative flex items-center justify-center">
                      {item.cover_image_url ? (
                        <img
                          src={item.cover_image_url}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const fb = e.currentTarget.parentElement.querySelector(".mini-fallback");
                            if (fb) fb.classList.remove("hidden");
                          }}
                        />
                      ) : null}
                      <div className={`mini-fallback ${item.cover_image_url ? "hidden" : ""} absolute inset-0 bg-gradient-to-br from-indigo-950 to-slate-900 flex items-center justify-center text-white/80 font-bold text-xs`}>
                        📖
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-foreground group-hover:text-accent transition truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-muted truncate mt-0.5">
                        {item.genres ? item.genres.slice(0, 2).join(", ") : (item.type || "Manga")}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Guest Community & AI Assistant Promo (if guest) */}
          {!user && (
            <div className="bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center text-xl">
                🤖
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">AI Manga Assistant</h3>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Ask our AI agent for personalized recommendations, trope matching, or plot lookups across 339,000+ titles.
                </p>
              </div>
              <Link
                to="/register"
                className="block w-full py-2.5 rounded-xl bg-accent text-white text-center font-bold text-xs shadow-md shadow-accent/20 hover:bg-accentHover transition"
              >
                Create Free Account &rarr;
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* 8. Corroborated Consensus Grid */}
      {corroborated.length > 0 && (
        <section className="space-y-4 pt-6 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">⭐</span>
                <h2 className="text-xl font-extrabold text-foreground tracking-tight">
                  High-Confidence Multi-Source Gold Titles
                </h2>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Titles verified across multiple major platforms (AniList & MangaUpdates).
              </p>
            </div>
            <Link
              to="/browse?sort=most_viewed_all"
              className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
            >
              <span>Browse All</span>
              <span>&rarr;</span>
            </Link>
          </div>
          <MangaGrid mangas={corroborated} />
        </section>
      )}
    </div>
  );
}
