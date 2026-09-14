import { useState } from "react";
import { updateMyProfile } from "../api/client";

const SCORE_SYSTEMS = [
  { value: "point_10_decimal", label: "10-Point Decimal (e.g. 8.5 / 10)" },
  { value: "point_100", label: "100-Point (e.g. 85 / 100)" },
  { value: "point_10", label: "10-Point Integer (e.g. 9 / 10)" },
  { value: "point_5", label: "5-Star Rating (e.g. ★★★★☆)" },
  { value: "point_3", label: "3-Point Smiley (e.g. 😊 / 😐 / 😞)" },
];

export default function ProfileEditModal({ profile, token, isOpen, onClose, onUpdated }) {
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [bannerUrl, setBannerUrl] = useState(profile?.banner_url || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [scoreSystem, setScoreSystem] = useState(profile?.score_system || "point_10_decimal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const updated = await updateMyProfile(token, {
        avatar_url: avatarUrl,
        banner_url: bannerUrl,
        bio,
        score_system: scoreSystem,
      });
      onUpdated(updated);
      onClose();
    } catch {
      setError("Failed to update profile. Please check URLs and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg rounded-3xl bg-surface border border-border p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-base font-extrabold text-foreground">Edit Profile & Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-foreground text-sm"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Avatar URL */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
              Avatar Image URL
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              className="w-full rounded-xl bg-ink border border-border px-3 py-2 text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {avatarUrl && (
              <div className="mt-2 flex items-center gap-2">
                <img
                  src={avatarUrl}
                  alt="Avatar Preview"
                  className="w-10 h-10 rounded-full object-cover border border-border"
                  onError={(e) => { e.target.style.display = "none"; }}
                />
                <span className="text-[10px] text-muted">Preview</span>
              </div>
            )}
          </div>

          {/* Banner URL */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
              Banner Image URL
            </label>
            <input
              type="url"
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://example.com/banner.jpg"
              className="w-full rounded-xl bg-ink border border-border px-3 py-2 text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {bannerUrl && (
              <div className="mt-2 h-16 w-full rounded-xl overflow-hidden border border-border">
                <img
                  src={bannerUrl}
                  alt="Banner Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              </div>
            )}
          </div>

          {/* Scoring System Selection (AniList feature) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
              Scoring System
            </label>
            <select
              value={scoreSystem}
              onChange={(e) => setScoreSystem(e.target.value)}
              className="w-full rounded-xl bg-ink border border-border px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {SCORE_SYSTEMS.map((sys) => (
                <option key={sys.value} value={sys.value}>
                  {sys.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-muted mt-1">
              Determines how scores are entered and displayed across your library and profile.
            </p>
          </div>

          {/* Bio / About Me */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
              About Me / Bio (Markdown)
            </label>
            <textarea
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Share your favorite genres, reading goals, or thoughts..."
              className="w-full rounded-xl bg-ink border border-border p-3 text-foreground placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent resize-y"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-surfaceHover font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-accent text-black font-bold hover:brightness-110 active:scale-95 transition disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
