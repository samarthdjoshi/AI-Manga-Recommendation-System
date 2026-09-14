import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't log in. Check your email and password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-12">
      <h1 className="text-2xl font-bold text-white mb-6">Log in</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="filter-label block mb-1.5">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-white
                       focus:outline-none focus:border-accent/50"
          />
        </div>

        <div>
          <label className="filter-label block mb-1.5">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-white
                       focus:outline-none focus:border-accent/50"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white
                     hover:bg-accent/90 transition disabled:opacity-50"
        >
          {submitting ? "Logging in..." : "Log in"}
        </button>
      </form>

      <p className="text-sm text-white/50 mt-5 text-center">
        Don't have an account?{" "}
        <Link to="/register" className="text-accent hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}
