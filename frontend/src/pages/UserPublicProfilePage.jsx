import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getPublicProfile,
  getUserTracking,
  getUserFavorites,
  getUserFollowers,
  getUserFollowing,
  toggleFollowUser,
  getManga,
  getMangaBatch,
  incrementChapter,
} from "../api/client";
import { useAuth } from "../context/useAuth";
import ActivityFeed from "../components/ActivityFeed";
import MangaCard from "../components/MangaCard";
import MangaListTracker from "../components/MangaListTracker";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";

function formatScoreBySystem(score, system = "point_10_decimal") {
  if (score == null) return "—";
  if (system === "point_100") {
    return `${Math.round(score * 10)}`;
  }
  if (system === "point_10") {
    return `${Math.round(score)}`;
  }
  if (system === "point_5") {
    const stars = Math.round(score / 2);
    return "★".repeat(Math.min(5, Math.max(1, stars))) + "☆".repeat(Math.max(0, 5 - stars));
  }
  if (system === "point_3") {
    if (score >= 7.5) return "😊";
    if (score >= 5.0) return "😐";
    return "😞";
  }
  return Number(score).toFixed(1);
}

export default function UserPublicProfilePage() {
  const { username, subtab } = useParams();
  const { token, user: currentUser } = useAuth();

  const activeSubtab = subtab || "overview";

  const [profile, setProfile] = useState(null);
  const [trackingEntries, setTrackingEntries] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [followLoading, setFollowLoading] = useState(false);
  const [incrementingId, setIncrementingId] = useState(null);

  const isOwnProfile = currentUser && currentUser.username?.toLowerCase() === username?.toLowerCase();

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const [profData, trackData, favData, followersData, followingData] = await Promise.all([
          getPublicProfile(username, token),
          getUserTracking(username).catch(() => ({ entries: [] })),
          getUserFavorites(username).catch(() => ({ favorites: [] })),
          getUserFollowers(username, token).catch(() => ({ users: [] })),
          getUserFollowing(username, token).catch(() => ({ users: [] })),
        ]);

        if (cancelled) return;
        setProfile(profData);
        setFollowers(followersData.users || []);
        setFollowing(followingData.users || []);

        const uniqueGoldIds = [
          ...new Set([
            ...trackData.entries.map((e) => e.gold_id),
            ...favData.favorites.map((f) => f.gold_id),
          ]),
        ];

        const mangaMap = await getMangaBatch(uniqueGoldIds);
        if (cancelled) return;

        setTrackingEntries(
          trackData.entries.map((e) => ({
            ...e,
            manga: mangaMap[e.gold_id] || { gold_id: e.gold_id, title: e.gold_id },
          }))
        );

        setFavorites(
          favData.favorites
            .map((f) => mangaMap[f.gold_id])
            .filter(Boolean)
        );
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.detail || "User not found or failed to load profile.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (username) {
      loadData();
    }

    return () => {
      cancelled = true;
    };
  }, [username, token]);

  async function handleToggleFollow() {
    if (!token || !profile || followLoading) return;
    try {
      setFollowLoading(true);
      const res = await toggleFollowUser(token, profile.username);
      setProfile((prev) => ({
        ...prev,
        is_following: res.is_following,
        followers_count: res.followers_count,
      }));
    } catch (err) {
      console.error("Failed to toggle follow", err);
    } finally {
      setFollowLoading(false);
    }
  }

  async function handleQuickIncrement(goldId) {
    if (!token || incrementingId) return;
    try {
      setIncrementingId(goldId);
      const res = await incrementChapter(token, goldId);
      setTrackingEntries((prev) =>
        prev.map((e) =>
          e.gold_id === goldId
            ? { ...e, progress: res.progress, status: res.status }
            : e
        )
      );
    } catch (err) {
      console.error("Failed to increment progress", err);
    } finally {
      setIncrementingId(null);
    }
  }

  const stats = useMemo(() => {
    const totalManga = trackingEntries.length;
    const completed = trackingEntries.filter((e) => e.status === "completed").length;
    const reading = trackingEntries.filter((e) => e.status === "reading").length;
    const totalChapters = trackingEntries.reduce((sum, e) => sum + (e.progress || 0), 0);
    const scoredEntries = trackingEntries.filter((e) => e.score != null && e.score > 0);
    const meanScore =
      scoredEntries.length > 0
        ? (scoredEntries.reduce((sum, e) => sum + e.score, 0) / scoredEntries.length).toFixed(1)
        : null;

    return { totalManga, completed, reading, totalChapters, meanScore };
  }, [trackingEntries]);

  const detailedStats = useMemo(() => {
    const scoreCounts = Array(10).fill(0);
    let totalScored = 0;
    trackingEntries.forEach((e) => {
      if (e.score != null && e.score > 0) {
        const rounded = Math.min(10, Math.max(1, Math.round(e.score)));
        scoreCounts[rounded - 1]++;
        totalScored++;
      }
    });

    const formatCounts = {};
    trackingEntries.forEach((e) => {
      const type = (e.manga?.type || "Manga").toUpperCase();
      formatCounts[type] = (formatCounts[type] || 0) + 1;
    });

    const statusCounts = {};
    trackingEntries.forEach((e) => {
      const st = e.status || "planning";
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    });

    const genreCounts = {};
    trackingEntries.forEach((e) => {
      (e.manga?.genres || []).forEach((g) => {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      });
    });
    const sortedGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);

    return {
      scoreCounts,
      maxScoreCount: Math.max(...scoreCounts, 1),
      totalScored,
      formatCounts: Object.entries(formatCounts).sort((a, b) => b[1] - a[1]),
      statusCounts: Object.entries(statusCounts),
      sortedGenres,
    };
  }, [trackingEntries]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <ErrorMessage message={error || "User not found"} />
        <div className="mt-4 text-center">
          <Link to="/" className="text-sm text-accent hover:underline">
            &larr; Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const navTabs = [
    { id: "overview", label: "Overview", to: `/user/${profile.username}` },
    { id: "mangalist", label: "Manga List", to: `/user/${profile.username}/mangalist` },
    { id: "favorites", label: "Favorites", to: `/user/${profile.username}/favorites` },
    { id: "stats", label: "Stats", to: `/user/${profile.username}/stats` },
    { id: "social", label: "Social", to: `/user/${profile.username}/social` },
    { id: "activity", label: "Activity", to: `/user/${profile.username}/activity` },
  ];

  return (
    <div className="min-h-screen pb-16 animate-fadeIn">
      {/* Banner Hero */}
      <div className="relative h-56 sm:h-72 md:h-84 w-full bg-gradient-to-r from-accent/20 via-surface to-accent/10 overflow-hidden border-b border-border">
        {profile.banner_url && (
          <img
            src={profile.banner_url}
            alt={`${profile.username} banner`}
            className="w-full h-full object-cover object-center"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      </div>

      {/* Header Info Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative -mt-16 sm:-mt-20 md:-mt-24">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-5 pb-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
            {/* Avatar */}
            <div className="w-32 h-32 sm:w-40 sm:h-40 md:w-44 md:h-44 rounded-3xl border-4 border-surface bg-surfaceHover overflow-hidden shadow-2xl shrink-0 flex items-center justify-center ring-2 ring-border/80">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              ) : (
                <span className="text-5xl md:text-6xl font-black text-accent">
                  {profile.username[0].toUpperCase()}
                </span>
              )}
            </div>

            {/* Name & Follower counts */}
            <div className="mb-1 space-y-2">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight flex items-center gap-3 flex-wrap">
                <span>{profile.username}</span>
                {isOwnProfile && (
                  <span className="text-xs px-3 py-0.5 rounded-full bg-accentSoft text-accent font-black uppercase tracking-wider border border-accent/30 shadow-xs">
                    You
                  </span>
                )}
              </h1>

              {/* Interactive Followers / Following */}
              <Link
                to={`/user/${profile.username}/social`}
                className="inline-flex items-center gap-4 text-xs sm:text-sm text-muted hover:text-foreground transition group p-1 -ml-1 rounded-xl hover:bg-surfaceHover/60"
                title="View followers and following"
              >
                <span className="flex items-baseline gap-1.5">
                  <strong className="text-foreground font-black text-sm sm:text-base group-hover:text-accent transition">
                    {profile.followers_count || 0}
                  </strong>
                  <span className="text-muted font-semibold">Followers</span>
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-border" />
                <span className="flex items-baseline gap-1.5">
                  <strong className="text-foreground font-black text-sm sm:text-base group-hover:text-accent transition">
                    {profile.following_count || 0}
                  </strong>
                  <span className="text-muted font-semibold">Following</span>
                </span>
              </Link>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end pt-1">
            {isOwnProfile ? (
              <Link
                to="/settings"
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-surface border border-border hover:border-accent text-sm font-bold text-foreground transition shadow-themeCard flex items-center gap-2 hover:bg-surfaceHover active:scale-95 cursor-pointer"
              >
                <span>⚙️</span>
                <span>Edit Profile</span>
              </Link>
            ) : (
              currentUser && (
                <button
                  type="button"
                  onClick={handleToggleFollow}
                  disabled={followLoading}
                  className={`min-h-[44px] px-6 py-2.5 rounded-xl text-sm font-bold transition shadow-sm cursor-pointer ${
                    profile.is_following
                      ? "bg-surface border border-border text-foreground hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30"
                      : "bg-accent hover:brightness-110 active:scale-95 text-accentFg"
                  }`}
                >
                  {followLoading
                    ? "Updating..."
                    : profile.is_following
                    ? "Following"
                    : "Follow"}
                </button>
              )
            )}
          </div>
        </div>

        {/* Primary Profile Navigation Tabs */}
        <div className="border-b border-border flex items-center gap-2 sm:gap-3 overflow-x-auto py-3 scrollbar-none flex-nowrap">
          {navTabs.map((tab) => {
            const isActive = activeSubtab === tab.id;
            return (
              <Link
                key={tab.id}
                to={tab.to}
                className={`min-h-[46px] px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? "bg-accent text-accentFg shadow-md font-black ring-2 ring-accent/30 border border-accent"
                    : "text-muted hover:text-foreground hover:bg-surfaceHover border border-transparent font-bold"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* SUBTAB 1: Overview */}
        {activeSubtab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            {/* Left Col: Bio + Stats + Favorites (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* About Card */}
              <div className="bg-surface border border-border rounded-3xl p-6 sm:p-7 shadow-themeCard space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-muted uppercase tracking-widest">About</h3>
                  {isOwnProfile && profile.bio && (
                    <Link to="/settings" className="text-xs text-accent hover:underline font-bold">
                      Edit &rarr;
                    </Link>
                  )}
                </div>
                {profile.bio ? (
                  <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                    {profile.bio}
                  </p>
                ) : (
                  <div className="space-y-3 py-1">
                    <p className="text-sm font-bold text-foreground">No bio written yet.</p>
                    <p className="text-xs text-muted leading-relaxed">
                      Tell the community a little about yourself, your favorite genres, and your reading journey.
                    </p>
                    {isOwnProfile && (
                      <Link
                        to="/settings"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline pt-1"
                      >
                        <span>Edit Profile</span>
                        <span>&rarr;</span>
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* Stats Card */}
              <div className="bg-surface border border-border rounded-3xl p-6 sm:p-7 shadow-themeCard space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-muted uppercase tracking-widest">Manga Stats</h3>
                  <Link to={`/user/${profile.username}/stats`} className="text-xs text-accent hover:underline font-bold">
                    Detailed Stats &rarr;
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="p-4 rounded-2xl bg-surfaceHover/80 border border-border/60 shadow-xs flex flex-col justify-between">
                    <div className="text-2xl sm:text-3xl font-black text-foreground">{stats.totalManga}</div>
                    <div className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-muted mt-1">Total Manga</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-surfaceHover/80 border border-border/60 shadow-xs flex flex-col justify-between">
                    <div className="text-2xl sm:text-3xl font-black text-foreground">{stats.totalChapters}</div>
                    <div className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-muted mt-1">Chapters Read</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-surfaceHover/80 border border-border/60 shadow-xs flex flex-col justify-between">
                    <div className="text-2xl sm:text-3xl font-black text-foreground">{stats.completed}</div>
                    <div className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-muted mt-1">Completed</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-surfaceHover/80 border border-border/60 shadow-xs flex flex-col justify-between">
                    <div className="text-2xl sm:text-3xl font-black text-accent">
                      {stats.meanScore ? formatScoreBySystem(stats.meanScore, profile.score_system) : "—"}
                    </div>
                    <div className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-muted mt-1">Mean Score</div>
                  </div>
                </div>
              </div>

              {/* Favorites Mini-Rail */}
              {favorites.length > 0 && (
                <div className="bg-surface border border-border rounded-3xl p-6 sm:p-7 shadow-themeCard">
                  <div className="flex items-center justify-between mb-3.5">
                    <h3 className="text-xs font-black text-muted uppercase tracking-widest">
                      Favorites ({favorites.length})
                    </h3>
                    <Link
                      to={`/user/${profile.username}/favorites`}
                      className="text-xs text-accent hover:underline font-bold"
                    >
                      View All &rarr;
                    </Link>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {favorites.slice(0, 6).map((manga) => (
                      <Link
                        key={manga.gold_id}
                        to={`/manga/${encodeURIComponent(manga.gold_id)}`}
                        className="group block aspect-[2/3] rounded-xl overflow-hidden border border-border/60 bg-surfaceHover relative shadow-sm"
                      >
                        {manga.cover_image_url ? (
                          <img
                            src={manga.cover_image_url}
                            alt={manga.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-muted p-1 text-center font-semibold">
                            {manga.title}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Col: Activity Feed (7 cols) */}
            <div className="lg:col-span-7">
              <div className="bg-surface border border-border rounded-3xl p-6 md:p-8 shadow-themeCard">
                <h3 className="text-base font-black text-foreground mb-4 flex items-center gap-2">
                  <span>Community Activity</span>
                </h3>
                <ActivityFeed
                  feedType="user"
                  username={profile.username}
                  currentUsername={currentUser?.username}
                />
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 2: Manga List */}
        {activeSubtab === "mangalist" && (
          <MangaListTracker
            entries={trackingEntries}
            scoreSystem={profile.score_system}
            isOwner={isOwnProfile}
            onIncrement={handleQuickIncrement}
            incrementingId={incrementingId}
            onRemoveTitles={(deletedIds) => {
              setTrackingEntries((prev) => prev.filter((e) => !deletedIds.includes(e.gold_id)));
            }}
          />
        )}

        {/* SUBTAB 3: Favorites */}
        {activeSubtab === "favorites" && (
          <div>
            {favorites.length === 0 ? (
              <div className="bg-surface border border-border rounded-3xl p-12 text-center text-muted space-y-3 shadow-sm">
                <div className="text-4xl">⭐</div>
                <h3 className="text-base font-bold text-foreground">No favorites added yet</h3>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  Mark your favorite manga and manhwa from their title pages to showcase them on your profile.
                </p>
                {isOwnProfile && (
                  <Link
                    to="/browse"
                    className="inline-block px-5 py-2.5 rounded-xl bg-accent text-accentFg text-xs font-bold shadow-sm hover:brightness-110 transition"
                  >
                    Browse Catalog
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-5 xl:gap-6">
                {favorites.map((manga) => (
                  <MangaCard key={manga.gold_id} manga={manga} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUBTAB 4: Stats */}
        {activeSubtab === "stats" && (
          <div className="space-y-8">
            {/* Overview KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-surface border border-border rounded-3xl p-6 text-center shadow-themeCard">
                <span className="text-xs uppercase tracking-wider text-muted font-bold">Total Manga</span>
                <p className="text-3xl sm:text-4xl font-black text-foreground mt-1.5">{stats.totalManga}</p>
              </div>
              <div className="bg-surface border border-border rounded-3xl p-6 text-center shadow-themeCard">
                <span className="text-xs uppercase tracking-wider text-muted font-bold">Chapters Read</span>
                <p className="text-3xl sm:text-4xl font-black text-foreground mt-1.5">{stats.totalChapters.toLocaleString()}</p>
              </div>
              <div className="bg-surface border border-border rounded-3xl p-6 text-center shadow-themeCard">
                <span className="text-xs uppercase tracking-wider text-muted font-bold">Mean Score</span>
                <p className="text-3xl sm:text-4xl font-black text-emerald-400 mt-1.5">
                  {stats.meanScore ? formatScoreBySystem(stats.meanScore, profile.score_system) : "—"}
                </p>
              </div>
              <div className="bg-surface border border-border rounded-3xl p-6 text-center shadow-themeCard">
                <span className="text-xs uppercase tracking-wider text-muted font-bold">Completed</span>
                <p className="text-3xl sm:text-4xl font-black text-foreground mt-1.5">{stats.completed}</p>
              </div>
            </div>

            {stats.totalManga === 0 ? (
              <div className="bg-surface border border-border rounded-3xl p-12 text-center text-muted space-y-3 shadow-themeCard">
                <div className="text-4xl">📊</div>
                <h3 className="text-base font-bold text-foreground">No tracking statistics yet</h3>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  Start reading and rating manga to generate personalized score histograms, format breakdowns, and genre analytics.
                </p>
              </div>
            ) : (
              <>
                {/* Score Distribution Histogram */}
                <div className="bg-surface border border-border rounded-3xl p-6 sm:p-8 shadow-themeCard">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-base font-black text-foreground">Score Distribution</h3>
                      <p className="text-xs text-muted mt-0.5">
                        {detailedStats.totalScored} scored manga across a 10-point scale
                      </p>
                    </div>
                  </div>

                  <div className="h-48 flex items-end justify-between gap-2 sm:gap-4 pt-6 px-2">
                    {detailedStats.scoreCounts.map((count, idx) => {
                      const score = idx + 1;
                      const pct = detailedStats.maxScoreCount > 0 ? (count / detailedStats.maxScoreCount) * 100 : 0;
                      return (
                        <div key={score} className="flex-1 flex flex-col items-center h-full justify-end group">
                          <span className="text-[11px] font-bold text-muted mb-1.5 opacity-0 group-hover:opacity-100 transition">
                            {count}
                          </span>
                          <div className="w-full max-w-[40px] bg-surfaceHover rounded-t-xl overflow-hidden flex flex-col justify-end h-full">
                            <div
                              style={{ height: `${Math.max(count > 0 ? 8 : 0, pct)}%` }}
                              className={`w-full transition-all duration-500 rounded-t-xl ${
                                score >= 8
                                  ? "bg-emerald-400"
                                  : score >= 6
                                  ? "bg-accent"
                                  : "bg-amber-500"
                              }`}
                            />
                          </div>
                          <span className="text-xs font-black text-foreground mt-2">{score}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Format Breakdown */}
                  <div className="bg-surface border border-border rounded-3xl p-6 sm:p-8 shadow-themeCard">
                    <h3 className="text-base font-black text-foreground mb-4">Format Breakdown</h3>
                    {detailedStats.formatCounts.length === 0 ? (
                      <p className="text-xs text-muted">No formats tracked yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {detailedStats.formatCounts.map(([format, count]) => {
                          const pct = stats.totalManga > 0 ? Math.round((count / stats.totalManga) * 100) : 0;
                          return (
                            <div key={format} className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="font-bold text-foreground">{format}</span>
                                <span className="text-muted font-medium">
                                  {count} ({pct}%)
                                </span>
                              </div>
                              <div className="w-full h-2.5 bg-surfaceHover rounded-full overflow-hidden">
                                <div
                                  style={{ width: `${pct}%` }}
                                  className="h-full bg-accent rounded-full transition-all duration-500"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Status Breakdown */}
                  <div className="bg-surface border border-border rounded-3xl p-6 sm:p-8 shadow-themeCard">
                    <h3 className="text-base font-black text-foreground mb-4">Status Distribution</h3>
                    {detailedStats.statusCounts.length === 0 ? (
                      <p className="text-xs text-muted">No status data available.</p>
                    ) : (
                      <div className="space-y-4">
                        {detailedStats.statusCounts.map(([st, count]) => {
                          const pct = stats.totalManga > 0 ? Math.round((count / stats.totalManga) * 100) : 0;
                          return (
                            <div key={st} className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="font-bold text-foreground capitalize">{st.replace("_", " ")}</span>
                                <span className="text-muted font-medium">
                                  {count} ({pct}%)
                                </span>
                              </div>
                              <div className="w-full h-2.5 bg-surfaceHover rounded-full overflow-hidden">
                                <div
                                  style={{ width: `${pct}%` }}
                                  className="h-full bg-accent rounded-full transition-all duration-500"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Top Genres */}
                {detailedStats.sortedGenres.length > 0 && (
                  <div className="bg-surface border border-border rounded-3xl p-6 sm:p-8 shadow-themeCard">
                    <h3 className="text-base font-black text-foreground mb-4">Top Genres</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {detailedStats.sortedGenres.map(([genre, count]) => (
                        <div
                          key={genre}
                          className="bg-surfaceHover border border-border rounded-2xl p-3.5 flex items-center justify-between shadow-xs"
                        >
                          <span className="text-xs font-bold text-foreground truncate pr-2">{genre}</span>
                          <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-surface text-accent shrink-0 border border-border/60">
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* SUBTAB 5: Social */}
        {activeSubtab === "social" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Followers */}
            <div className="bg-surface border border-border rounded-3xl p-6 sm:p-8 space-y-4 shadow-themeCard">
              <h3 className="text-base font-black text-foreground">Followers ({followers.length})</h3>
              {followers.length === 0 ? (
                <div className="py-8 text-center text-muted space-y-2">
                  <div className="text-2xl">👥</div>
                  <p className="text-xs font-medium">No followers yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {followers.map((u) => (
                    <div key={u.id} className="py-3 flex items-center justify-between">
                      <Link to={`/user/${u.username}`} className="flex items-center gap-3 hover:text-accent transition">
                        <div className="w-11 h-11 rounded-2xl bg-surfaceHover border border-border overflow-hidden flex items-center justify-center text-sm font-black text-accent shrink-0 shadow-sm">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
                          ) : (
                            u.username[0].toUpperCase()
                          )}
                        </div>
                        <span className="text-sm font-bold text-foreground">{u.username}</span>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Following */}
            <div className="bg-surface border border-border rounded-3xl p-6 sm:p-8 space-y-4 shadow-themeCard">
              <h3 className="text-base font-black text-foreground">Following ({following.length})</h3>
              {following.length === 0 ? (
                <div className="py-8 text-center text-muted space-y-2">
                  <div className="text-2xl">🔍</div>
                  <p className="text-xs font-medium">Not following anyone yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {following.map((u) => (
                    <div key={u.id} className="py-3 flex items-center justify-between">
                      <Link to={`/user/${u.username}`} className="flex items-center gap-3 hover:text-accent transition">
                        <div className="w-11 h-11 rounded-2xl bg-surfaceHover border border-border overflow-hidden flex items-center justify-center text-sm font-black text-accent shrink-0 shadow-sm">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
                          ) : (
                            u.username[0].toUpperCase()
                          )}
                        </div>
                        <span className="text-sm font-bold text-foreground">{u.username}</span>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUBTAB 6: Activity */}
        {activeSubtab === "activity" && (
          <div className="max-w-3xl mx-auto bg-surface border border-border rounded-3xl p-6 md:p-8 shadow-themeCard">
            <h3 className="text-base font-black text-foreground mb-4 flex items-center gap-2">
              <span>Personal Activity</span>
            </h3>
            <ActivityFeed
              feedType="user"
              username={profile.username}
              currentUsername={currentUser?.username}
            />
          </div>
        )}
      </div>
    </div>
  );
}
