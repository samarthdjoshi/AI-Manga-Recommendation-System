import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { useTheme } from "../context/useTheme";
import {
  getMyProfile,
  updateMyProfile,
  updateAccount,
  changePassword,
} from "../api/client";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";

const SCORING_SYSTEMS = [
  {
    id: "point_100",
    name: "100 Point (1-100)",
    desc: "Rate manga with granular precision from 1 to 100.",
    example: "Score: 98 / 100",
  },
  {
    id: "point_10_decimal",
    name: "10 Point Decimal (1.0-10.0)",
    desc: "Single decimal precision (AniList standard).",
    example: "Score: 9.5 / 10",
  },
  {
    id: "point_10",
    name: "10 Point Integer (1-10)",
    desc: "Clean whole numbers from 1 to 10.",
    example: "Score: 9 / 10",
  },
  {
    id: "point_5",
    name: "5 Star (1-5)",
    desc: "Classic star ratings with half-star visual equivalent.",
    example: "Score: ★★★★☆",
  },
  {
    id: "point_3",
    name: "3 Point Smileys",
    desc: "Simple emotional sentiment (Good, Average, Bad).",
    example: "Score: 😊 / 😐 / 😞",
  },
];

const TITLE_LANGUAGES = [
  { id: "romaji", name: "Romaji (Default)", example: "Shingeki no Kyojin" },
  { id: "english", name: "English", example: "Attack on Titan" },
  { id: "native", name: "Native (Japanese/Korean)", example: "進撃の巨人" },
];

export default function SettingsPage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const { token, user, loading: authLoading } = useAuth();
  const {
    appearance,
    setAppearance,
    setTheme,
    resolvedTheme,
    availableThemes,
  } = useTheme();

  const lightThemes = (availableThemes || []).filter((t) => t.type === "light");
  const darkThemes = (availableThemes || []).filter((t) => t.type === "dark");

  const activeTab = tab || "profile";

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Profile fields
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [bio, setBio] = useState("");
  const [titleLanguage, setTitleLanguage] = useState("romaji");
  const [scoreSystem, setScoreSystem] = useState("point_10_decimal");
  const [savingProfile, setSavingProfile] = useState(false);

  // Account fields
  const [email, setEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Lists & Scoring
  const [savingLists, setSavingLists] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      navigate("/login?redirect=/settings");
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError("");
        const data = await getMyProfile(token);
        if (cancelled) return;
        setProfile(data);
        setAvatarUrl(data.avatar_url || "");
        setBannerUrl(data.banner_url || "");
        setBio(data.bio || "");
        setTitleLanguage(data.title_language || "romaji");
        setScoreSystem(data.score_system || "point_10_decimal");
        setEmail(data.email || "");
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.detail || "Failed to load account settings.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();

    return () => {
      cancelled = true;
    };
  }, [token, authLoading, navigate]);

  function notifySuccess(msg) {
    setSuccessMsg(msg);
    setError("");
    setTimeout(() => {
      setSuccessMsg("");
    }, 4000);
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!token) return;
    try {
      setSavingProfile(true);
      setError("");
      const updated = await updateMyProfile(token, {
        avatar_url: avatarUrl.trim() || null,
        banner_url: bannerUrl.trim() || null,
        bio: bio.trim() || null,
        title_language: titleLanguage,
        score_system: scoreSystem,
      });
      setProfile(updated);
      notifySuccess("Profile details updated successfully.");
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to save profile changes.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleUpdateEmail(e) {
    e.preventDefault();
    if (!token || !email.trim()) return;
    try {
      setSavingEmail(true);
      setError("");
      const updated = await updateAccount(token, { email: email.trim() });
      setProfile(updated);
      notifySuccess("Email address updated successfully.");
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to update email.");
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError("");
    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    try {
      setSavingPassword(true);
      setError("");
      await changePassword(token, currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      notifySuccess("Password changed successfully.");
    } catch (err) {
      setPasswordError(err?.response?.data?.detail || "Failed to change password.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSaveLists(e) {
    e.preventDefault();
    if (!token) return;
    try {
      setSavingLists(true);
      setError("");
      const updated = await updateMyProfile(token, {
        score_system: scoreSystem,
        title_language: titleLanguage,
      });
      setProfile(updated);
      notifySuccess("List and scoring preferences saved.");
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to save list settings.");
    } finally {
      setSavingLists(false);
    }
  }

  if (loading || authLoading) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner />
      </div>
    );
  }

  const tabs = [
    {
      id: "profile",
      path: "/settings",
      label: "Profile",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: "account",
      path: "/settings/account",
      label: "Account",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      id: "lists",
      path: "/settings/lists",
      label: "Lists & Scoring",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    {
      id: "appearance",
      path: "/settings/appearance",
      label: "Appearance & Themes",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Breadcrumb */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">Settings</h1>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Manage your MangaVerse profile, account credentials, and display preferences.
          </p>
        </div>
        {user?.username && (
          <Link
            to={`/user/${user.username}`}
            className="text-xs px-3.5 py-2 rounded-xl border border-border bg-surface hover:border-accent text-muted hover:text-foreground transition flex items-center gap-1.5 shadow-xs font-semibold"
          >
            <span>View Public Profile</span>
            <span>&rarr;</span>
          </Link>
        )}
      </div>

      {/* Status Messages */}
      {successMsg && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2 font-medium">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{successMsg}</span>
        </div>
      )}
      {error && <ErrorMessage message={error} />}

      {/* Main Grid: Sidebar + Form Content */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 sm:gap-8">
        {/* Left Sidebar Nav */}
        <aside className="md:col-span-1 space-y-1">
          <nav className="bg-surface border border-border rounded-2xl p-2.5 space-y-1 shadow-themeCard">
            {tabs.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition ${
                    isActive
                      ? "bg-accent text-accentFg shadow-sm"
                      : "text-muted hover:text-foreground hover:bg-surfaceHover"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Right Content Area */}
        <main className="md:col-span-3">
          {/* TAB 1: Profile */}
          {activeTab === "profile" && (
            <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 space-y-8 shadow-themeCard">
              <div>
                <h2 className="text-xl font-bold text-foreground">Profile Settings</h2>
                <p className="text-sm text-muted mt-1">
                  Customize how you appear to others on your public profile and in activity feeds.
                </p>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-6">
                {/* Avatar Preview & URL */}
                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">
                    Avatar Image URL
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl border border-border bg-surfaceHover overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Avatar preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="text-2xl text-muted font-bold">
                          {user?.username ? user.username[0].toUpperCase() : "U"}
                        </span>
                      )}
                    </div>
                    <input
                      type="url"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://example.com/avatar.jpg"
                      className="flex-1 bg-surfaceHover border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-muted focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                {/* Banner Preview & URL */}
                <div>
                  <label className="block text-sm font-bold text-foreground mb-2">
                    Banner Image URL
                  </label>
                  <div className="space-y-2.5">
                    {bannerUrl ? (
                      <div className="w-full h-28 rounded-xl border border-border bg-surfaceHover overflow-hidden shadow-xs">
                        <img
                          src={bannerUrl}
                          alt="Banner preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-20 rounded-xl border border-dashed border-border bg-surfaceHover/50 flex items-center justify-center text-xs text-muted">
                        No custom banner provided. A radiant gradient will be used by default.
                      </div>
                    )}
                    <input
                      type="url"
                      value={bannerUrl}
                      onChange={(e) => setBannerUrl(e.target.value)}
                      placeholder="https://example.com/banner.jpg"
                      className="w-full bg-surfaceHover border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-muted focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-foreground">About / Bio</label>
                    <span className="text-xs text-muted">{bio.length}/5000</span>
                  </div>
                  <textarea
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell other readers about your favorite genres, top manga, or reading journey..."
                    className="w-full bg-surfaceHover border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-muted focus:outline-none focus:border-accent resize-y"
                  />
                  {bio && (
                    <div className="mt-2.5 p-3.5 bg-surfaceHover/70 border border-border rounded-xl">
                      <div className="text-xs font-bold text-muted mb-1 uppercase tracking-wider">Preview:</div>
                      <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">{bio}</p>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-6 py-2.5 rounded-xl bg-accent text-accentFg text-sm font-bold hover:brightness-110 active:scale-95 transition shadow-sm disabled:opacity-50 min-h-[42px] cursor-pointer"
                  >
                    {savingProfile ? "Saving..." : "Save Profile Details"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: Account */}
          {activeTab === "account" && (
            <div className="space-y-8">
              {/* Email Section */}
              <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 space-y-6 shadow-themeCard">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Account Email</h2>
                  <p className="text-sm text-muted mt-1">
                    Update the primary email address associated with your MangaVerse account.
                  </p>
                </div>

                <form onSubmit={handleUpdateEmail} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-bold text-foreground mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-surfaceHover border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-muted focus:outline-none focus:border-accent"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingEmail || email === profile?.email}
                    className="px-6 py-2.5 rounded-xl bg-accent text-accentFg text-sm font-bold hover:brightness-110 active:scale-95 transition shadow-sm disabled:opacity-50 min-h-[42px] cursor-pointer"
                  >
                    {savingEmail ? "Updating..." : "Update Email"}
                  </button>
                </form>
              </div>

              {/* Password Section */}
              <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 space-y-6 shadow-themeCard">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Change Password</h2>
                  <p className="text-sm text-muted mt-1">
                    Ensure your account is using a long, secure password.
                  </p>
                </div>

                {passwordError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm font-medium">
                    {passwordError}
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-bold text-foreground mb-1.5">
                      Current Password
                    </label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-surfaceHover border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-muted focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-foreground mb-1.5">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full bg-surfaceHover border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-muted focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-foreground mb-1.5">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-surfaceHover border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-muted focus:outline-none focus:border-accent"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="px-6 py-2.5 rounded-xl bg-accent text-accentFg text-sm font-bold hover:brightness-110 active:scale-95 transition shadow-sm disabled:opacity-50 min-h-[42px] cursor-pointer"
                  >
                    {savingPassword ? "Updating Password..." : "Change Password"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: Lists & Scoring */}
          {activeTab === "lists" && (
            <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 space-y-8 shadow-themeCard">
              <div>
                <h2 className="text-xl font-bold text-foreground">Lists & Scoring System</h2>
                <p className="text-sm text-muted mt-1">
                  Choose your preferred scoring scale (matching AniList formats) and title display language.
                </p>
              </div>

              <form onSubmit={handleSaveLists} className="space-y-8">
                {/* Scoring System */}
                <div>
                  <label className="block text-sm font-bold text-foreground mb-3">
                    Scoring System
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {SCORING_SYSTEMS.map((sys) => {
                      const isSelected = scoreSystem === sys.id;
                      return (
                        <button
                          key={sys.id}
                          type="button"
                          onClick={() => setScoreSystem(sys.id)}
                          className={`p-4 rounded-xl border text-left transition ${
                            isSelected
                              ? "border-accent bg-accent/15 shadow-sm ring-1 ring-accent/30"
                              : "border-border bg-surfaceHover/60 hover:border-accent/40 hover:bg-surfaceHover"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-sm text-foreground">{sys.name}</span>
                            {isSelected && (
                              <span className="w-2.5 h-2.5 rounded-full bg-accent" />
                            )}
                          </div>
                          <p className="text-xs text-muted mb-2">{sys.desc}</p>
                          <div className="text-xs font-mono font-bold text-accent">
                            {sys.example}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Title Language */}
                <div>
                  <label className="block text-sm font-bold text-foreground mb-3">
                    Title Language Preference
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {TITLE_LANGUAGES.map((lang) => {
                      const isSelected = titleLanguage === lang.id;
                      return (
                        <button
                          key={lang.id}
                          type="button"
                          onClick={() => setTitleLanguage(lang.id)}
                          className={`p-4 rounded-xl border text-left transition ${
                            isSelected
                              ? "border-accent bg-accent/15 shadow-sm ring-1 ring-accent/30"
                              : "border-border bg-surfaceHover/60 hover:border-accent/40 hover:bg-surfaceHover"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-sm text-foreground">{lang.name}</span>
                            {isSelected && (
                              <span className="w-2.5 h-2.5 rounded-full bg-accent" />
                            )}
                          </div>
                          <div className="text-xs text-muted italic">{lang.example}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingLists}
                    className="px-6 py-2.5 rounded-xl bg-accent text-accentFg text-sm font-bold hover:brightness-110 active:scale-95 transition shadow-sm disabled:opacity-50 min-h-[42px] cursor-pointer"
                  >
                    {savingLists ? "Saving..." : "Save List Preferences"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: Appearance & Themes */}
          {activeTab === "appearance" && (
            <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 space-y-8 shadow-themeCard">
              <div>
                <h2 className="text-xl font-bold text-foreground">Appearance & Visual Themes</h2>
                <p className="text-xs sm:text-sm text-muted mt-1">
                  Customize the interface palette, brightness mode, and atmosphere across MangaVerse.
                </p>
              </div>

              {/* Mode Selector */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted mb-3 block">
                  Mode Preference
                </label>
                <div className="grid grid-cols-3 gap-3 max-w-md">
                  {[
                    { id: "dark", label: "Dark Mode", icon: "🌙" },
                    { id: "light", label: "Light Mode", icon: "☀️" },
                    { id: "system", label: "System Sync", icon: "💻" },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setAppearance(mode.id)}
                      className={`py-3 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        appearance === mode.id
                          ? "bg-accent text-accentFg border-accent shadow-md"
                          : "bg-surfaceHover text-foreground border-border hover:border-accent/40"
                      }`}
                    >
                      <span>{mode.icon}</span>
                      <span>{mode.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dark Palettes */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Dark Themes
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-bold border border-accent/20">
                    {darkThemes.length} available
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {darkThemes.map((item) => {
                    const isSelected = resolvedTheme === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTheme(item.id)}
                        className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                          isSelected
                            ? "border-accent ring-2 ring-accent/30 bg-surfaceHover shadow-md"
                            : "border-border bg-surfaceHover/50 hover:border-accent/40 hover:bg-surfaceHover"
                        }`}
                      >
                        <div
                          className="h-12 rounded-xl p-2.5 flex items-center justify-between mb-3 border shadow-xs"
                          style={{
                            backgroundColor: item.preview.bg,
                            borderColor: item.preview.border,
                          }}
                        >
                          <div
                            className="px-2.5 py-1 rounded-md text-xs font-bold shadow-xs"
                            style={{
                              backgroundColor: item.preview.surface,
                              color: item.preview.text,
                            }}
                          >
                            Aa
                          </div>
                          <div
                            className="w-6 h-6 rounded-full shadow-sm ring-1 ring-black/20"
                            style={{ backgroundColor: item.preview.accent }}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-foreground">{item.name}</span>
                          {isSelected && (
                            <span className="text-xs font-bold text-accent flex items-center gap-1">
                              ✓ Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted mt-1 line-clamp-1">{item.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Light Palettes */}
              <div className="space-y-3.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Light Themes
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-bold border border-accent/20">
                    {lightThemes.length} available
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {lightThemes.map((item) => {
                    const isSelected = resolvedTheme === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTheme(item.id)}
                        className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                          isSelected
                            ? "border-accent ring-2 ring-accent/30 bg-surfaceHover shadow-md"
                            : "border-border bg-surfaceHover/50 hover:border-accent/40 hover:bg-surfaceHover"
                        }`}
                      >
                        <div
                          className="h-12 rounded-xl p-2.5 flex items-center justify-between mb-3 border shadow-xs"
                          style={{
                            backgroundColor: item.preview.bg,
                            borderColor: item.preview.border,
                          }}
                        >
                          <div
                            className="px-2.5 py-1 rounded-md text-xs font-bold shadow-xs"
                            style={{
                              backgroundColor: item.preview.surface,
                              color: item.preview.text,
                            }}
                          >
                            Aa
                          </div>
                          <div
                            className="w-6 h-6 rounded-full shadow-sm ring-1 ring-black/20"
                            style={{ backgroundColor: item.preview.accent }}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-foreground">{item.name}</span>
                          {isSelected && (
                            <span className="text-xs font-bold text-accent flex items-center gap-1">
                              ✓ Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted mt-1 line-clamp-1">{item.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
