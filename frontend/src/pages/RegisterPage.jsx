import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({ email, username, password });
      navigate("/");
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.code === "ECONNABORTED" || !err.response) {
        setError("The server was waking up from idle. Please click 'Create Account' again to finish.");
      } else {
        setError(detail || "Couldn't create an account. Please check your details.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const isAlreadyRegistered =
    error &&
    (error.toLowerCase().includes("already registered") ||
      error.toLowerCase().includes("already taken") ||
      error.toLowerCase().includes("email already"));

  return (
    <div className="max-w-md mx-auto mt-10 sm:mt-16 px-4">
      <div className="rounded-3xl bg-surface border border-border/80 p-6 sm:p-8 shadow-xl">
        <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-2 tracking-tight">
          Create an account
        </h1>
        <p className="text-xs sm:text-sm text-foreground/60 mb-6">
          Join MangaVerse to track reading progress, bookmark favorites, and get AI recommendations.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-foreground/70 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl bg-ink/50 border border-border px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/35
                         focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-foreground/70 mb-1.5">
              Username
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={50}
              pattern="[a-zA-Z0-9_]+"
              title="Letters, numbers, and underscores only"
              autoComplete="username"
              placeholder="e.g. samarth"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl bg-ink/50 border border-border px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground/35
                         focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition"
            />
            <p className="text-xs text-foreground/45 mt-1">Letters, numbers, and underscores (min 3 chars).</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-foreground/70 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
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
            <p className="text-xs text-foreground/45 mt-1">Must be at least 8 characters.</p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-semibold text-red-500 space-y-1.5">
              <p>{error}</p>
              {isAlreadyRegistered && (
                <div className="pt-1 text-xs">
                  <Link to="/login" className="text-accent underline font-bold">
                    Click here to log in or reset your password →
                  </Link>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white
                       hover:bg-accentHover transition shadow-md shadow-accent/25 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Connecting to server...</span>
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <p className="text-xs sm:text-sm text-foreground/60 mt-6 text-center border-t border-border/60 pt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-accent font-bold hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
