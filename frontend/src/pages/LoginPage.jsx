import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function LoginPage() {
  const { login, resetUserPassword } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Reset password mode
  const [isResetMode, setIsResetMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetSuccess, setResetSuccess] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isResetMode) {
        if (newPassword.length < 8) {
          setError("New password must be at least 8 characters.");
          setSubmitting(false);
          return;
        }
        await resetUserPassword({ email, newPassword });
        setResetSuccess("Password reset successfully! Logging you in...");
        setTimeout(() => navigate("/"), 1200);
      } else {
        await login({ email, password });
        navigate("/");
      }
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          (isResetMode
            ? "Couldn't reset password. Please check your email or username."
            : "Invalid email/username or password. Check your credentials.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10 sm:mt-16 px-4">
      <div className="rounded-3xl bg-surface border border-border/80 p-6 sm:p-8 shadow-xl">
        <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-2 tracking-tight">
          {isResetMode ? "Reset Password" : "Log in to MangaVerse"}
        </h1>
        <p className="text-xs sm:text-sm text-foreground/60 mb-6">
          {isResetMode
            ? "Enter your email or username and choose a new password."
            : "Welcome back! Enter your email or username to access your library."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-foreground/70 mb-1.5">
              Email or Username
            </label>
            <input
              type="text"
              required
              autoComplete="username"
              placeholder="e.g. samarth or user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl bg-ink/50 border border-border px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/35
                         focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition"
            />
          </div>

          {!isResetMode ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground/70">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsResetMode(true);
                    setError(null);
                  }}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl bg-ink/50 border border-border px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/35
                             focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-foreground/50 hover:text-foreground transition"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground/70 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl bg-ink/50 border border-border px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/35
                             focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-foreground/50 hover:text-foreground transition"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <p className="text-xs text-foreground/45 mt-1">Must be at least 8 characters.</p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-semibold text-red-500">
              {error}
            </div>
          )}

          {resetSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-500">
              {resetSuccess}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white
                       hover:bg-accentHover transition shadow-md shadow-accent/25 disabled:opacity-50"
          >
            {submitting
              ? isResetMode
                ? "Resetting password..."
                : "Logging in..."
              : isResetMode
              ? "Reset & Log In"
              : "Log In"}
          </button>

          {isResetMode && (
            <button
              type="button"
              onClick={() => {
                setIsResetMode(false);
                setError(null);
              }}
              className="w-full text-center text-xs font-bold text-foreground/60 hover:text-foreground py-1"
            >
              ← Back to standard login
            </button>
          )}
        </form>

        <p className="text-xs sm:text-sm text-foreground/60 mt-6 text-center border-t border-border/60 pt-4">
          Don't have an account?{" "}
          <Link to="/register" className="text-accent font-bold hover:underline">
            Register now
          </Link>
        </p>
      </div>
    </div>
  );
}
