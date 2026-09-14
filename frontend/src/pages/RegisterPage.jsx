import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
      setError(err.response?.data?.detail || "Couldn't create an account. Please check your details.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-12">
      <h1 className="text-2xl font-bold text-white mb-6">Create an account</h1>

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
          <label className="filter-label block mb-1.5">Username</label>
          <input
            type="text"
            required
            minLength={3}
            maxLength={50}
            pattern="[a-zA-Z0-9_]+"
            title="Letters, numbers, and underscores only"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-white
                       focus:outline-none focus:border-accent/50"
          />
        </div>

        <div>
          <label className="filter-label block mb-1.5">Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-white
                       focus:outline-none focus:border-accent/50"
          />
          <p className="text-xs text-white/35 mt-1">At least 8 characters.</p>
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
          {submitting ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="text-sm text-white/50 mt-5 text-center">
        Already have an account?{" "}
        <Link to="/login" className="text-accent hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
