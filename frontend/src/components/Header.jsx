import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import SearchBar from "./SearchBar";
import { useAuth } from "../context/useAuth";
import { useTheme } from "../context/useTheme";
import NotificationBell from "./NotificationBell";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { openThemeModal, isDark, appearance } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function handleSearch(query) {
    if (query && query.trim()) {
      setMobileMenuOpen(false);
      navigate(`/browse?q=${encodeURIComponent(query.trim())}`);
    }
  }

  const navLinks = [
    { label: "Home", path: user ? "/home" : "/" },
    { label: "Browse", path: "/browse" },
    { label: "Trending", path: "/trending" },
    { label: "Top 100", path: "/top-100" },
    { label: "Manhwa", path: "/manhwa" },
    { label: "Discover", path: "/discover" },
    ...(user ? [{ label: "My Library", path: "/library" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-ink/95 backdrop-blur-xl transition-colors">
      <div className="mx-auto max-w-[1440px] px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-6">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 sm:gap-3 shrink-0 group py-1">
          <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-accent via-indigo-500 to-purple-500 flex items-center justify-center font-black text-white text-lg sm:text-xl shadow-md shadow-accent/20 group-hover:scale-105 transition-all duration-300">
            <span>⚡</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-lg sm:text-xl font-black tracking-tight text-foreground group-hover:text-accent transition-colors">
                MangaVerse
              </span>
              <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-accent/15 text-accent font-extrabold uppercase tracking-wider border border-accent/25">
                PRO
              </span>
            </div>
            <span className="text-[11px] font-medium text-muted tracking-tight hidden lg:inline -mt-0.5">
              Manga & Manhwa Universe
            </span>
          </div>
        </Link>

        {/* Desktop Primary Nav */}
        <nav className="hidden xl:flex items-center gap-1 shrink-0">
          {navLinks.map((link) => {
            const isActive =
              link.path === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-1.5 rounded-xl text-xs xl:text-sm font-bold tracking-tight transition-all duration-200 ${
                  isActive
                    ? "bg-accent text-white shadow-md shadow-accent/20"
                    : "text-muted hover:text-foreground hover:bg-surfaceHover"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Global Search */}
        <div className="flex-1 min-w-[180px] max-w-xs md:max-w-sm lg:max-w-md hidden sm:block">
          <SearchBar onSearch={handleSearch} compact dropdownAlign="right" />
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Theme Switcher Button */}
          <button
            type="button"
            onClick={openThemeModal}
            className="h-9 sm:h-10 px-2 sm:px-3 rounded-xl border border-border bg-surface text-foreground hover:border-accent/50 hover:bg-surfaceHover transition-all flex items-center justify-center gap-1.5 text-xs font-semibold shadow-sm"
            title="Choose visual theme and appearance"
            aria-label="Open visual theme selector"
          >
            <span className="text-sm sm:text-base">
              {appearance === "system" ? "💻" : isDark ? "🌙" : "☀️"}
            </span>
            <span className="hidden md:inline text-xs font-bold text-foreground">
              Theme
            </span>
          </button>

          {/* User Auth or Profile */}
          {user ? (
            <div className="flex items-center gap-2.5">
              <NotificationBell />

              {/* User Avatar Menu Dropdown (AniList parity) */}
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1 rounded-2xl border border-border bg-surface hover:border-accent/50 transition-all text-xs font-semibold text-foreground focus:outline-none shadow-sm group"
                  aria-expanded={userDropdownOpen}
                  aria-haspopup="true"
                >
                  <div className="w-9 h-9 rounded-xl bg-accent text-white flex items-center justify-center text-sm font-bold uppercase overflow-hidden shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                    ) : (
                      user.username ? user.username[0] : "U"
                    )}
                  </div>
                  <span className="max-w-[90px] truncate hidden sm:inline text-sm font-bold text-foreground">
                    {user.username}
                  </span>
                  <svg
                    className={`w-4 h-4 text-muted transition-transform duration-200 ${userDropdownOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-surface border border-border shadow-2xl z-50 p-2 animate-fadeIn space-y-1">
                    <div className="px-3.5 py-2.5 border-b border-border/70 mb-1.5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center text-base font-bold uppercase shrink-0 overflow-hidden">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                        ) : (
                          user.username ? user.username[0] : "U"
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-foreground truncate">{user.username}</div>
                        <div className="text-xs text-muted truncate">{user.email}</div>
                      </div>
                    </div>

                    <Link
                      to={`/user/${user.username}`}
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-surfaceHover hover:text-accent transition"
                    >
                      <span className="text-base">👤</span>
                      <span>Profile</span>
                    </Link>

                    <Link
                      to={`/user/${user.username}/mangalist`}
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-surfaceHover hover:text-accent transition"
                    >
                      <span className="text-base">📖</span>
                      <span>Manga List</span>
                    </Link>

                    <Link
                      to="/library"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-surfaceHover hover:text-accent transition"
                    >
                      <span className="text-base">📚</span>
                      <span>Private Library</span>
                    </Link>

                    <Link
                      to="/favorites"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-surfaceHover hover:text-accent transition"
                    >
                      <span className="text-base">⭐</span>
                      <span>Favorites</span>
                    </Link>

                    <Link
                      to={`/user/${user.username}/stats`}
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-surfaceHover hover:text-accent transition"
                    >
                      <span className="text-base">📊</span>
                      <span>Statistics</span>
                    </Link>

                    <Link
                      to={`/user/${user.username}/social`}
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-surfaceHover hover:text-accent transition"
                    >
                      <span className="text-base">👥</span>
                      <span>Social Network</span>
                    </Link>

                    <Link
                      to="/notifications"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-surfaceHover hover:text-accent transition"
                    >
                      <span className="text-base">🔔</span>
                      <span>Notifications</span>
                    </Link>

                    <Link
                      to="/settings"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-surfaceHover hover:text-accent transition"
                    >
                      <span className="text-base">⚙️</span>
                      <span>Settings</span>
                    </Link>

                    <div className="border-t border-border/70 pt-1 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          logout();
                          navigate("/");
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition text-left"
                      >
                        <span className="text-base">🚪</span>
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2 sm:gap-3">
              <Link
                to="/login"
                className="px-3.5 py-2 text-sm font-bold text-foreground hover:text-accent transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-4.5 py-2 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accentHover transition-colors shadow-md shadow-accent/20"
              >
                Join Free
              </Link>
            </div>
          )}

          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="xl:hidden h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-xl border border-border text-foreground hover:bg-surfaceHover transition-colors shrink-0"
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-t border-border bg-surface px-4 py-5 space-y-4 animate-fadeIn">
          {/* Guest Action Callout on Mobile */}
          {!user && (
            <div className="grid grid-cols-2 gap-2 pb-1">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 px-3 rounded-xl text-center border border-border bg-surfaceHover text-foreground text-xs sm:text-sm font-bold hover:border-accent transition"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 px-3 rounded-xl text-center bg-accent text-white text-xs sm:text-sm font-bold hover:bg-accentHover transition shadow-md shadow-accent/20"
              >
                Join Free
              </Link>
            </div>
          )}

          {/* Mobile Search */}
          <div className="sm:hidden">
            <SearchBar onSearch={handleSearch} compact />
          </div>

          {/* Navigation Links */}
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold text-center border transition-all ${
                  location.pathname === link.path
                    ? "bg-accent text-white border-accent shadow-md shadow-accent/20"
                    : "bg-surfaceHover text-foreground border-border hover:border-accent/40"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* User Section in Mobile */}
          {user ? (
            <div className="pt-3 border-t border-border space-y-3">
              <div className="flex items-center gap-3 px-2">
                <div className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center text-sm font-bold uppercase overflow-hidden shrink-0">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                  ) : (
                    user.username ? user.username[0] : "U"
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-foreground">{user.username}</div>
                  <div className="text-xs text-muted truncate">{user.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                <Link
                  to={`/user/${user.username}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 text-center rounded-xl bg-surfaceHover border border-border text-foreground hover:text-accent"
                >
                  Profile
                </Link>
                <Link
                  to={`/user/${user.username}/mangalist`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 text-center rounded-xl bg-surfaceHover border border-border text-foreground hover:text-accent"
                >
                  Manga List
                </Link>
                <Link
                  to="/favorites"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 text-center rounded-xl bg-surfaceHover border border-border text-foreground hover:text-accent"
                >
                  Favorites
                </Link>
                <Link
                  to={`/user/${user.username}/stats`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 text-center rounded-xl bg-surfaceHover border border-border text-foreground hover:text-accent"
                >
                  Stats
                </Link>
                <Link
                  to={`/user/${user.username}/social`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 text-center rounded-xl bg-surfaceHover border border-border text-foreground hover:text-accent"
                >
                  Social
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 text-center rounded-xl bg-surfaceHover border border-border text-foreground hover:text-accent"
                >
                  Settings
                </Link>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                    navigate("/");
                  }}
                  className="text-xs font-bold text-rose-400 hover:underline py-1"
                >
                  Log Out ({user.username})
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-3 border-t border-border flex gap-3">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 py-3 text-center rounded-xl bg-surfaceHover border border-border text-foreground text-sm font-bold"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 py-3 text-center rounded-xl bg-accent text-white text-sm font-bold shadow-md shadow-accent/20"
              >
                Join Free
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
