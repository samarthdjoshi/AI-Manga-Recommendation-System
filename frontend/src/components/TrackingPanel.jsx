import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  addEntryToCustomList,
  createCustomList,
  deleteTagForManga,
  getCustomList,
  getTagsForManga,
  listCustomLists,
  listTracking,
  removeEntryFromCustomList,
  removeTracking,
  saveTracking,
  setTagsForManga,
} from "../api/client";
import { useAuth } from "../context/useAuth";
import { recordVaultTracking, removeVaultTracking } from "../utils/libraryVault";

const statuses = [
  ["reading", "Reading"],
  ["completed", "Completed"],
  ["planning", "Planning"],
  ["paused", "Paused"],
  ["dropped", "Dropped"],
  ["re_reading", "Re-reading"],
];

const emptyTracking = { status: "planning", progress: 0, score: "", notes: "" };

export default function TrackingPanel({ goldId, token }) {
  const { user } = useAuth();
  const [tracking, setTracking] = useState(emptyTracking);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(Boolean(token));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Custom Lists state
  const [allLists, setAllLists] = useState([]);
  const [selectedListIds, setSelectedListIds] = useState(new Set());
  const [newListOpen, setNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [listBusy, setListBusy] = useState(false);

  // Private Tags state
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [tagBusy, setTagBusy] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;

    Promise.all([
      listTracking(token),
      listCustomLists(token),
      getTagsForManga(goldId, token).catch(() => ({ tags: [] })),
    ])
      .then(async ([trackingData, listsData, tagsData]) => {
        if (cancelled) return;

        // 1. Tracking
        const entry = trackingData.entries.find((item) => item.gold_id === goldId);
        if (entry) {
          setExists(true);
          setTracking({
            status: entry.status,
            progress: entry.progress,
            score: entry.score ?? "",
            notes: entry.notes ?? "",
          });
        }

        // 2. Custom Lists
        const lists = listsData.lists || [];
        setAllLists(lists);

        // Fetch detail for each list to see if goldId is in it
        const containedIds = new Set();
        await Promise.all(
          lists.map(async (l) => {
            try {
              const detail = await getCustomList(l.id, token);
              if (detail.entries && detail.entries.includes(goldId)) {
                containedIds.add(l.id);
              }
            } catch {
              // Ignore single list failure
            }
          })
        );
        if (!cancelled) setSelectedListIds(containedIds);

        // 3. Private Tags
        if (!cancelled) setTags(tagsData.tags || []);
      })
      .catch(() => !cancelled && setError("Couldn't load your library data."))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [goldId, token]);

  if (!token) {
    return (
      <section className="mt-6 rounded-xl border border-border bg-surface p-4">
        <h2 className="filter-label">Your progress</h2>
        <p className="mt-2 text-sm text-muted">
          <Link className="text-accent hover:underline" to="/login">
            Log in
          </Link>{" "}
          to track your reading, progress, score, custom lists, and private notes.
        </p>
      </section>
    );
  }

  async function save() {
    setBusy(true);
    setError("");
    const payload = {
      ...tracking,
      progress: Number(tracking.progress) || 0,
      score: tracking.score === "" ? null : Number(tracking.score),
    };
    try {
      await saveTracking(goldId, payload, token);
      recordVaultTracking(user?.id || user?.email, goldId, payload);
      setExists(true);
    } catch {
      setError("Couldn't save your progress. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setError("");
    try {
      await removeTracking(goldId, token);
      removeVaultTracking(user?.id || user?.email, goldId);
      setTracking(emptyTracking);
      setExists(false);
    } catch {
      setError("Couldn't remove this tracking entry. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleListMembership(listId) {
    const isMember = selectedListIds.has(listId);
    const updated = new Set(selectedListIds);
    if (isMember) {
      updated.delete(listId);
    } else {
      updated.add(listId);
    }
    setSelectedListIds(updated);

    try {
      if (isMember) {
        await removeEntryFromCustomList(listId, goldId, token);
      } else {
        await addEntryToCustomList(listId, goldId, token);
      }
    } catch {
      // Revert on failure
      setSelectedListIds(selectedListIds);
      setError("Failed to update custom list membership.");
    }
  }

  async function handleCreateList(e) {
    e.preventDefault();
    const name = newListName.trim();
    if (!name) return;
    setListBusy(true);
    try {
      const created = await createCustomList({ name }, token);
      await addEntryToCustomList(created.id, goldId, token);
      setAllLists((prev) => [...prev, created]);
      setSelectedListIds((prev) => new Set([...prev, created.id]));
      setNewListName("");
      setNewListOpen(false);
    } catch {
      setError("Couldn't create custom list. Check for duplicate name.");
    } finally {
      setListBusy(false);
    }
  }

  async function handleAddTag(e) {
    e?.preventDefault();
    const tag = tagInput.trim().toLowerCase();
    if (!tag || tags.includes(tag)) {
      setTagInput("");
      return;
    }
    setTagBusy(true);
    const newTags = [...tags, tag];
    try {
      const res = await setTagsForManga(goldId, newTags, token);
      setTags(res.tags);
      setTagInput("");
    } catch {
      setError("Couldn't save tag.");
    } finally {
      setTagBusy(false);
    }
  }

  async function handleRemoveTag(tagToRemove) {
    setTagBusy(true);
    try {
      await deleteTagForManga(goldId, tagToRemove, token);
      setTags((prev) => prev.filter((t) => t !== tagToRemove));
    } catch {
      setError("Couldn't remove tag.");
    } finally {
      setTagBusy(false);
    }
  }

  return (
    <section
      className="mt-6 rounded-2xl border border-border bg-surface p-5 max-w-2xl shadow-sm space-y-6"
      aria-busy={loading}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h2 className="text-base font-extrabold text-foreground">Reading Progress & Tracking</h2>
          <p className="text-xs text-muted">Manage status, progress, custom lists, and private notes.</p>
        </div>
        {exists && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accentSoft text-accent">
            Saved
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading your library details…</p>
      ) : (
        <>
          {/* Tracking Status, Progress, Score */}
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-xs font-semibold text-muted">
              Status
              <select
                value={tracking.status}
                onChange={(e) => setTracking({ ...tracking, status: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-border bg-ink px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
              >
                {statuses.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              Progress (chapters)
              <input
                type="number"
                min="0"
                max="100000"
                value={tracking.progress}
                onChange={(e) => setTracking({ ...tracking, progress: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-border bg-ink px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Your score (0–10)
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={tracking.score}
                onChange={(e) => setTracking({ ...tracking, score: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-border bg-ink px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </label>
          </div>

          {/* Notes */}
          <label className="block text-xs font-semibold text-muted">
            Private notes
            <textarea
              value={tracking.notes}
              maxLength={2000}
              rows={3}
              placeholder="Your thoughts, reminders, or chapter markers..."
              onChange={(e) => setTracking({ ...tracking, notes: e.target.value })}
              className="mt-1 block w-full resize-y rounded-xl border border-border bg-ink px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
            />
          </label>

          {/* Custom Lists Section */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted">Custom Lists</span>
              <button
                type="button"
                onClick={() => setNewListOpen((v) => !v)}
                className="text-xs text-accent font-semibold hover:underline"
              >
                {newListOpen ? "Cancel" : "+ New List"}
              </button>
            </div>

            {newListOpen && (
              <form onSubmit={handleCreateList} className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="List name (e.g. Masterpieces)"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  maxLength={100}
                  className="flex-1 rounded-xl border border-border bg-ink px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={listBusy || !newListName.trim()}
                  className="rounded-xl bg-accent px-3 py-1.5 text-xs font-bold text-accentFg disabled:opacity-50"
                >
                  Create
                </button>
              </form>
            )}

            {allLists.length === 0 && !newListOpen ? (
              <p className="text-xs text-muted italic">No custom lists created yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allLists.map((lst) => {
                  const isChecked = selectedListIds.has(lst.id);
                  return (
                    <button
                      key={lst.id}
                      type="button"
                      onClick={() => toggleListMembership(lst.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                        isChecked
                          ? "border-accent bg-accentSoft text-accent font-semibold"
                          : "border-border bg-surfaceHover/50 text-muted hover:text-foreground"
                      }`}
                    >
                      <span>{isChecked ? "✓" : "+"}</span>
                      <span>{lst.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Private Tags Section */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted">Private Tags</span>
              <span className="text-[10px] text-muted">Only visible to you</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surfaceHover border border-border text-xs font-medium text-foreground"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    disabled={tagBusy}
                    className="text-muted hover:text-red-400 font-bold ml-0.5"
                    title={`Remove tag #${t}`}
                  >
                    ×
                  </button>
                </span>
              ))}

              <form onSubmit={handleAddTag} className="inline-flex items-center gap-1">
                <input
                  type="text"
                  placeholder="Add tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  maxLength={50}
                  className="w-24 rounded-lg border border-border bg-ink px-2 py-1 text-xs text-foreground focus:outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={tagBusy || !tagInput.trim()}
                  className="rounded-lg bg-surfaceHover border border-border px-2 py-1 text-xs text-muted hover:text-foreground disabled:opacity-50"
                >
                  +
                </button>
              </form>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-400 font-medium bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
              {error}
            </p>
          )}

          <div className="mt-4 flex gap-3 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="rounded-xl bg-accent px-5 py-2 text-xs font-bold text-accentFg hover:bg-accentHover transition-colors shadow-sm disabled:opacity-50"
            >
              {exists ? "Update progress" : "Save progress"}
            </button>
            {exists && (
              <button
                type="button"
                disabled={busy}
                onClick={clear}
                className="rounded-xl border border-border px-4 py-2 text-xs font-medium text-muted hover:text-foreground hover:bg-surfaceHover transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

