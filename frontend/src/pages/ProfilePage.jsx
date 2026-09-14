import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ErrorMessage from "../components/ErrorMessage";
import LoadingSpinner from "../components/LoadingSpinner";
import ActivityFeed from "../components/ActivityFeed";
import ProfileEditModal from "../components/ProfileEditModal";
import {
  getManga,
  listFavorites,
  listTracking,
  getMyProfile,
  getUserFollowers,
  getUserFollowing,
  incrementChapter,
} from "../api/client";
import { useAuth } from "../context/useAuth";

function formatScoreBySystem(score, system = "point_10_decimal") {
  if (score == null) return "—";
  if (system === "point_100") {
    return `${Math.round(score * 10)} / 100`;
  }
  if (system === "point_10") {
    return `${Math.round(score)} / 10`;
  }
  if (system === "point_5") {
    const stars = Math.round(score / 2);
    return "★".repeat(Math.min(5, Math.max(1, stars))) + "☆".repeat(Math.max(0, 5 - stars));
  }
  if (system === "point_3") {
    if (score >= 7.5) return "😊 (Good)";
    if (score >= 5.0) return "😐 (Average)";
    return "😞 (Poor)";
  }
  return `${Number(score).toFixed(1)} / 10`;
}

function distribution(items) {
  return Object.entries(
    items.reduce((counts, item) => {
      counts[item] = (counts[item] || 0) + 1;
      return counts;
    }, {})
  ).sort(([, first], [, second]) => second - first);
}

export default function ProfilePage() {
  const { token, user, loading: authLoading } = useAuth();

  const [profileData, setProfileData] = useState(null);
  const [tracking, setTracking] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "manga_list" | "stats" | "activities" | "social"
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [socialModalMode, setSocialModalMode] = useState(null); // null | "followers" | "following"
  const [incrementingId, setIncrementingId] = useState(null);

  useEffect(() => {
    if (authLoading || !token) return undefined;
    let cancelled = false;

    async function loadAll() {
      try {
        const [prof, trackData, favData] = await Promise.all([
          getMyProfile(token).catch(() => null),
          listTracking(token),
          listFavorites(token),
        ]);

        if (cancelled) return;
        if (prof) setProfileData(prof);

        const ids = [
          ...new Set([
            ...trackData.entries.map((entry) => entry.gold_id),
            ...favData.favorites.map((favorite) => favorite.gold_id),
          ]),
        ];
        const titles = await Promise.all(ids.map((id) => getManga(id).catch(() => null)));
        if (cancelled) return;
        const byId = Object.fromEntries(titles.filter(Boolean).map((title) => [title.gold_id, title]));

        setTracking(
          trackData.entries
            .map((entry) => ({ ...entry, manga: byId[entry.gold_id] }))
            .filter((entry) => entry.manga)
        );
        setFavorites(favData.favorites.map((favorite) => byId[favorite.gold_id]).filter(Boolean));

        if (user?.username) {
          const [fData, fgData] = await Promise.all([
            getUserFollowers(user.username, token).catch(() => ({ users: [] })),
            getUserFollowing(user.username, token).catch(() => ({ users: [] })),
          ]);
          if (!cancelled) {
            setFollowers(fData.users || []);
            setFollowing(fgData.users || []);
          }
        }
      } catch {
        if (!cancelled) setError("Couldn't load your profile. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [authLoading, token, user?.username]);

  async function handleQuickIncrement(goldId) {
    if (!token || incrementingId === goldId) return;
    setIncrementingId(goldId);
    try {
      const res = await incrementChapter(token, goldId);
      setTracking((prev) =>
        prev.map((t) =>
          t.gold_id === goldId
            ? { ...t, progress: res.progress, status: res.status }
            : t
        )
      );
    } catch {
      // silent
    } finally {
      setIncrementingId(null);
    }
  }

  const statistics = useMemo(() => {
    const totalChapters = tracking.reduce((sum, e) => sum + (e.progress || 0), 0);
    const scored = tracking.filter((entry) => typeof entry.score === "number");
    const meanScore = scored.length
      ? scored.reduce((sum, entry) => sum + entry.score, 0) / scored.length
      : null;

    // Score distribution histogram (1-10)
    const scoreBuckets = Array.from({ length: 10 }, (_, i) => ({ score: i + 1, count: 0 }));
    scored.forEach((e) => {
      const rounded = Math.min(10, Math.max(1, Math.round(e.score)));
      scoreBuckets[rounded - 1].count += 1;
    });

    const genres = distribution(tracking.flatMap((entry) => entry.manga.genres || []));
    const types = distribution(tracking.map((entry) => entry.manga.media_type).filter(Boolean));
    const years = distribution(tracking.map((entry) => entry.manga.year).filter(Boolean)).sort(
      ([a], [b]) => Number(a) - Number(b)
    );

    const statusCounts = distribution(tracking.map((entry) => entry.status));

    return {
      totalTitles: tracking.length,
      totalChapters,
      meanScore,
      scoreBuckets,
      genres: genres.slice(0, 10),
      types,
      years,
      statusCounts,
    };
  }, [tracking]);

  if (authLoading || loading) return <LoadingSpinner label="Loading your AniList profile..." />;

  if (!token) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <h1 className="text-2xl font-extrabold text-foreground">Your Profile</h1>
        <p className="mt-2 text-sm text-muted">Sign in to access your personal reading lists and favorites.</p>
        <Link
          to="/login"
          className="mt-6 inline-block rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-accentFg shadow-sm hover:bg-accentHover transition-colors"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (error) return <ErrorMessage message={error} />;

  const displayUser = profileData || user;
  const scoreSystem = profileData?.score_system || "point_10_decimal";

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Profile Header Hero (Banner + Floating Avatar) */}
      <div className="relative rounded-3xl bg-surface border border-border overflow-hidden shadow-themeCard">
        {/* Banner */}
        <div className="h-44 sm:h-60 w-full bg-gradient-to-r from-accent/30 via-ink to-surfaceHover overflow-hidden relative">
          {displayUser.banner_url ? (
            <img src={displayUser.banner_url} alt="Profile Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted/40 font-mono text-xs select-none">
              MangaVerse Profile
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
        </div>

        {/* Hero Bottom Bar */}
        <div className="px-6 pb-6 pt-0 relative flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 sm:-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            {/* Avatar */}
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-surface border-4 border-surface shadow-2xl overflow-hidden flex items-center justify-center shrink-0 font-black text-2xl sm:text-3xl text-accent ring-2 ring-border">
              {displayUser.avatar_url ? (
                <img src={displayUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span>{displayUser.username ? displayUser.username[0].toUpperCase() : "U"}</span>
              )}
            </div>

            {/* Username & Bio Summary */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  {displayUser.username}
                </h1>
                <span className="px-2 py-0.5 rounded-lg bg-accentSoft text-accent text-[10px] font-bold uppercase tracking-wider">
                  AniList Suite
                </span>
              </div>
              <p className="text-xs text-muted max-w-md line-clamp-2">
                {displayUser.bio || "No bio yet. Click Edit Profile to add one."}
              </p>
              {/* Followers & Following Stats */}
              <div className="flex items-center gap-4 text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setSocialModalMode("followers")}
                  className="text-muted hover:text-foreground transition"
                >
                  <strong className="text-foreground font-bold">{followers.length}</strong> Followers
                </button>
                <button
                  type="button"
                  onClick={() => setSocialModalMode("following")}
                  className="text-muted hover:text-foreground transition"
                >
                  <strong className="text-foreground font-bold">{following.length}</strong> Following
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditModalOpen(true)}
              className="px-4 py-2 rounded-xl border border-border bg-ink text-foreground hover:border-accent text-xs font-semibold shadow-sm transition"
            >
              Edit Profile
            </button>
            <Link
              to="/library"
              className="px-4 py-2 rounded-xl bg-accent text-black text-xs font-bold hover:brightness-110 transition shadow-sm"
            >
              Full Library →
            </Link>
          </div>
        </div>

        {/* Quick Stats Ribbon */}
        <div className="border-t border-border grid grid-cols-2 sm:grid-cols-4 divide-x divide-border bg-ink/40">
          <div className="p-3.5 text-center">
            <span className="text-base sm:text-lg font-black text-foreground block">
              {statistics.totalTitles}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Total Manga</span>
          </div>
          <div className="p-3.5 text-center">
            <span className="text-base sm:text-lg font-black text-foreground block">
              {statistics.totalChapters}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Chapters Read</span>
          </div>
          <div className="p-3.5 text-center">
            <span className="text-base sm:text-lg font-black text-accent block">
              {statistics.meanScore ? formatScoreBySystem(statistics.meanScore, scoreSystem) : "—"}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Mean Score</span>
          </div>
          <div className="p-3.5 text-center">
            <span className="text-base sm:text-lg font-black text-foreground block">
              {favorites.length}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Favorites</span>
          </div>
        </div>
      </div>

      {/* Profile Navigation Tabs (AniList style) */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-surface border border-border overflow-x-auto">
        {[
          { id: "overview", label: "Overview" },
          { id: "manga_list", label: `Manga List (${tracking.length})` },
          { id: "stats", label: "Stats & Analytics" },
          { id: "activities", label: "Activities & Feed" },
          { id: "social", label: `Social (${followers.length + following.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              activeTab === tab.id
                ? "bg-accent text-black shadow-sm"
                : "text-muted hover:text-foreground hover:bg-surfaceHover"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Activity Feed highlights & Currently Reading */}
          <div className="lg:col-span-2 space-y-6">
            {/* Currently Reading Highlights */}
            <div className="rounded-3xl bg-surface border border-border p-5 shadow-themeCard">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Currently Reading
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab("manga_list")}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  View All →
                </button>
              </div>

              {tracking.filter((e) => e.status === "reading").length === 0 ? (
                <p className="text-xs text-muted py-4 text-center">No manga currently in progress.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {tracking
                    .filter((e) => e.status === "reading")
                    .slice(0, 4)
                    .map((entry) => (
                      <div
                        key={entry.gold_id}
                        className="p-3 rounded-2xl bg-ink border border-border flex items-center gap-3 group"
                      >
                        <div className="w-12 h-16 rounded-xl overflow-hidden bg-surface shrink-0 border border-border">
                          {entry.manga.cover_image_url ? (
                            <img src={entry.manga.cover_image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-muted">Cover</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link to={`/manga/${encodeURIComponent(entry.gold_id)}`} className="text-xs font-bold text-foreground truncate block hover:text-accent">
                            {entry.manga.title}
                          </Link>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted">
                            <span>Ch. {entry.progress || 0}</span>
                            <span>•</span>
                            <span className="text-accent font-semibold">{formatScoreBySystem(entry.score, scoreSystem)}</span>
                          </div>
                          {/* Quick Increment button */}
                          <button
                            type="button"
                            onClick={() => handleQuickIncrement(entry.gold_id)}
                            disabled={incrementingId === entry.gold_id}
                            className="mt-1.5 px-2.5 py-0.5 rounded-lg bg-accentSoft border border-accent/40 text-accent font-bold text-[10px] hover:bg-accent hover:text-black transition"
                          >
                            +1 Chapter
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="rounded-3xl bg-surface border border-border p-5 shadow-themeCard">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground mb-4">
                Personal Activity
              </h2>
              <ActivityFeed initialFeed="user" filterUsername={displayUser.username} />
            </div>
          </div>

          {/* Right Col: About Me Markdown & Favorites Showcase */}
          <div className="space-y-6">
            <div className="rounded-3xl bg-surface border border-border p-5 shadow-themeCard">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground mb-2">
                About Me
              </h2>
              <p className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed">
                {displayUser.bio || "No bio added yet. Tell other readers about your tastes and favorites!"}
              </p>
            </div>

            <div className="rounded-3xl bg-surface border border-border p-5 shadow-themeCard">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Favorites
                </h2>
                <span className="text-xs text-muted font-semibold">{favorites.length}</span>
              </div>
              {favorites.length === 0 ? (
                <p className="text-xs text-muted py-4 text-center">No favorites saved yet.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {favorites.slice(0, 6).map((fav) => (
                    <Link
                      key={fav.gold_id}
                      to={`/manga/${encodeURIComponent(fav.gold_id)}`}
                      className="group rounded-xl overflow-hidden border border-border bg-ink aspect-[2/3] relative block"
                      title={fav.title}
                    >
                      {fav.cover_image_url ? (
                        <img src={fav.cover_image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] p-1 text-center text-muted">
                          {fav.title}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: AniList-Style Manga List with Quick Increment & Scoring */}
      {activeTab === "manga_list" && (
        <div className="rounded-3xl bg-surface border border-border p-5 shadow-themeCard space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-extrabold text-foreground">Tracked Manga List</h2>
            <Link to="/library" className="text-xs font-bold text-accent hover:underline">
              Manage in Library →
            </Link>
          </div>

          {tracking.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted">
              No manga currently tracked. Discover titles to add to your list!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted">
                    <th className="pb-3 w-12">Cover</th>
                    <th className="pb-3">Title</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Progress</th>
                    <th className="pb-3">Score</th>
                    <th className="pb-3 text-right">Quick Log</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {tracking.map((entry) => (
                    <tr key={entry.gold_id} className="hover:bg-surfaceHover/60 transition-colors">
                      <td className="py-2.5">
                        <div className="w-9 h-12 rounded-lg overflow-hidden bg-ink border border-border shrink-0">
                          {entry.manga.cover_image_url ? (
                            <img src={entry.manga.cover_image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] text-muted">Cover</div>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <Link to={`/manga/${encodeURIComponent(entry.gold_id)}`} className="font-bold text-foreground hover:text-accent block truncate max-w-xs sm:max-w-md">
                          {entry.manga.title}
                        </Link>
                        <span className="text-[10px] text-muted">{entry.manga.year || "Year unknown"} • {entry.manga.media_type || "Manga"}</span>
                      </td>
                      <td className="py-2.5 capitalize pr-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-ink border border-border text-foreground">
                          {entry.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-2.5 font-medium pr-3">
                        Ch. {entry.progress || 0}
                      </td>
                      <td className="py-2.5 text-accent font-bold pr-3">
                        {formatScoreBySystem(entry.score, scoreSystem)}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleQuickIncrement(entry.gold_id)}
                          disabled={incrementingId === entry.gold_id}
                          className="px-2.5 py-1 rounded-lg bg-accent text-black font-bold text-[11px] hover:brightness-110 active:scale-95 transition disabled:opacity-50"
                        >
                          +1 Ch
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Stats & Analytics (Histograms, Distributions) */}
      {activeTab === "stats" && (
        <div className="space-y-6">
          {/* Score Distribution Histogram */}
          <div className="rounded-3xl bg-surface border border-border p-5 shadow-themeCard">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground mb-1">
              Score Distribution Histogram
            </h2>
            <p className="text-xs text-muted mb-4">
              Breakdown of personal ratings assigned across your library.
            </p>

            <div className="h-44 flex items-end gap-2 sm:gap-4 pt-6 border-b border-border">
              {statistics.scoreBuckets.map((bucket) => {
                const maxCount = Math.max(1, ...statistics.scoreBuckets.map((b) => b.count));
                const heightPct = bucket.count > 0 ? (bucket.count / maxCount) * 100 : 4;
                return (
                  <div key={bucket.score} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <span className="text-[10px] font-bold text-accent mb-1 opacity-0 group-hover:opacity-100 transition">
                      {bucket.count}
                    </span>
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-lg transition-all duration-300 ${
                        bucket.count > 0 ? "bg-accent hover:brightness-110" : "bg-ink border border-border/50"
                      }`}
                    />
                    <span className="text-[11px] font-semibold text-muted mt-2 block">
                      {bucket.score}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Format & Status Breakdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Format Distribution */}
            <div className="rounded-3xl bg-surface border border-border p-5 shadow-themeCard">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground mb-3">
                Format Breakdown
              </h2>
              <div className="space-y-2.5">
                {statistics.types.length === 0 ? (
                  <p className="text-xs text-muted">No formats tracked yet.</p>
                ) : (
                  statistics.types.map(([fmt, count]) => {
                    const pct = Math.round((count / statistics.totalTitles) * 100);
                    return (
                      <div key={fmt} className="space-y-1 text-xs">
                        <div className="flex justify-between font-semibold">
                          <span className="text-foreground">{fmt}</span>
                          <span className="text-muted">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-ink overflow-hidden">
                          <div style={{ width: `${pct}%` }} className="h-full bg-accent rounded-full" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Status Distribution */}
            <div className="rounded-3xl bg-surface border border-border p-5 shadow-themeCard">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground mb-3">
                Status Distribution
              </h2>
              <div className="space-y-2.5">
                {statistics.statusCounts.map(([st, count]) => {
                  const pct = Math.round((count / statistics.totalTitles) * 100);
                  return (
                    <div key={st} className="space-y-1 text-xs">
                      <div className="flex justify-between font-semibold">
                        <span className="capitalize text-foreground">{st.replace("_", " ")}</span>
                        <span className="text-muted">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-ink overflow-hidden">
                        <div style={{ width: `${pct}%` }} className="h-full bg-accentSoft border border-accent/50 rounded-full" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top Genres Breakdown */}
          <div className="rounded-3xl bg-surface border border-border p-5 shadow-themeCard">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground mb-3">
              Top Genres Breakdown
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {statistics.genres.map(([genre, count]) => (
                <div key={genre} className="p-3 rounded-2xl bg-ink border border-border text-center">
                  <span className="text-sm font-black text-accent block">{count}</span>
                  <span className="text-xs font-semibold text-foreground truncate block">{genre}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Activities & Feed */}
      {activeTab === "activities" && (
        <div className="rounded-3xl bg-surface border border-border p-5 shadow-themeCard">
          <ActivityFeed initialFeed="global" />
        </div>
      )}

      {/* Tab 5: Social (Followers & Following) */}
      {activeTab === "social" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="rounded-3xl bg-surface border border-border p-5 shadow-themeCard space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Followers ({followers.length})
            </h2>
            {followers.length === 0 ? (
              <p className="text-xs text-muted">No followers yet.</p>
            ) : (
              <div className="space-y-2">
                {followers.map((u) => (
                  <div key={u.id} className="p-3 rounded-2xl bg-ink border border-border flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-surface border border-border overflow-hidden flex items-center justify-center font-bold text-xs text-accent">
                        {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : u.username[0].toUpperCase()}
                      </div>
                      <span className="text-xs font-bold text-foreground">{u.username}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-surface border border-border p-5 shadow-themeCard space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Following ({following.length})
            </h2>
            {following.length === 0 ? (
              <p className="text-xs text-muted">Not following anyone yet.</p>
            ) : (
              <div className="space-y-2">
                {following.map((u) => (
                  <div key={u.id} className="p-3 rounded-2xl bg-ink border border-border flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-surface border border-border overflow-hidden flex items-center justify-center font-bold text-xs text-accent">
                        {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : u.username[0].toUpperCase()}
                      </div>
                      <span className="text-xs font-bold text-foreground">{u.username}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      <ProfileEditModal
        profile={displayUser}
        token={token}
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onUpdated={(updated) => setProfileData(updated)}
      />

      {/* Followers / Following Modal */}
      {socialModalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-surface border border-border p-5 shadow-2xl space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                {socialModalMode === "followers" ? "Followers" : "Following"}
              </h3>
              <button
                type="button"
                onClick={() => setSocialModalMode(null)}
                className="p-1 rounded-lg text-muted hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {(socialModalMode === "followers" ? followers : following).length === 0 ? (
                <p className="text-xs text-muted py-6 text-center">
                  No {socialModalMode} yet.
                </p>
              ) : (
                (socialModalMode === "followers" ? followers : following).map((u) => (
                  <div key={u.id} className="p-2.5 rounded-xl bg-ink border border-border flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-surface border border-border overflow-hidden flex items-center justify-center font-bold text-xs text-accent shrink-0">
                      {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : u.username[0].toUpperCase()}
                    </div>
                    <span className="text-xs font-bold text-foreground truncate">{u.username}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
