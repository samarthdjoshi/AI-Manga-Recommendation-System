import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  bulkDeleteLibrary,
  bulkUpdateLibrary,
  commitImportLibrary,
  createCustomList,
  deleteCustomList,
  downloadLibraryExport,
  getCustomList,
  getManga,
  getMangaBatch,
  incrementChapter,
  listAllTags,
  listCustomLists,
  listFavorites,
  listTracking,
  previewImportLibrary,
  saveTracking,
  updateCustomList,
} from "../api/client";
import { useAuth } from "../context/useAuth";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import {
  getLocalVault,
  saveLocalVault,
  recordVaultTracking,
  removeVaultTracking,
  reconcileTrackingWithServer,
} from "../utils/libraryVault";

const STATUS_TABS = [
  { id: "all", label: "All Titles", icon: "📚" },
  { id: "reading", label: "Reading", icon: "📖" },
  { id: "completed", label: "Completed", icon: "✅" },
  { id: "planning", label: "Planning", icon: "📌" },
  { id: "paused", label: "Paused", icon: "⏸️" },
  { id: "dropped", label: "Dropped", icon: "⏹️" },
  { id: "re_reading", label: "Re-reading", icon: "🔄" },
];

const SORT_OPTIONS = [
  { id: "title", label: "Title (A–Z)" },
  { id: "progress", label: "Progress (Most Read)" },
  { id: "score", label: "Score (Highest)" },
  { id: "updated", label: "Last Updated" },
];

export default function LibraryPage() {
  const navigate = useNavigate();
  const { token, user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active view tab: "all", status id, "favorites", "list:{id}", "tag:{tag}"
  const activeTab = searchParams.get("tab") || "all";

  const userId = user?.id || user?.email;

  // Instant Data state (hydrated from persistent vault and localStorage for 0ms render)
  const [loading, setLoading] = useState(() => {
    try {
      const v = getLocalVault(userId);
      if (v?.trackingEntries?.length || (v?.mangaMap && Object.keys(v.mangaMap).length)) return false;
      const c = localStorage.getItem("mangaverse_library_cache");
      return !c;
    } catch {
      return true;
    }
  });
  const [error, setError] = useState("");
  const [trackingEntries, setTrackingEntries] = useState(() => {
    try {
      const v = getLocalVault(userId);
      if (v?.trackingEntries?.length) return v.trackingEntries;
      const c = JSON.parse(localStorage.getItem("mangaverse_library_cache") || "{}");
      return c.trackingEntries || [];
    } catch {
      return [];
    }
  });
  const [favoriteIds, setFavoriteIds] = useState(() => {
    try {
      const v = getLocalVault(userId);
      if (v?.favoriteIds?.length) return new Set(v.favoriteIds);
      const c = JSON.parse(localStorage.getItem("mangaverse_library_cache") || "{}");
      return new Set(c.favoriteIds || []);
    } catch {
      return new Set();
    }
  });
  const [customLists, setCustomLists] = useState(() => {
    try {
      const v = getLocalVault(userId);
      if (v?.customLists?.length) return v.customLists;
      const c = JSON.parse(localStorage.getItem("mangaverse_library_cache") || "{}");
      return c.customLists || [];
    } catch {
      return [];
    }
  });
  const [customListEntries, setCustomListEntries] = useState(() => {
    try {
      const v = getLocalVault(userId);
      if (v?.customListEntries) return v.customListEntries;
      const c = JSON.parse(localStorage.getItem("mangaverse_library_cache") || "{}");
      return c.customListEntries || {};
    } catch {
      return {};
    }
  });
  const [tagsByGoldId, setTagsByGoldId] = useState(() => {
    try {
      const v = getLocalVault(userId);
      if (v?.tagsByGoldId) return v.tagsByGoldId;
      const c = JSON.parse(localStorage.getItem("mangaverse_library_cache") || "{}");
      return c.tagsByGoldId || {};
    } catch {
      return {};
    }
  });
  const [mangaMap, setMangaMap] = useState(() => {
    try {
      const v = getLocalVault(userId);
      if (v?.mangaMap && Object.keys(v.mangaMap).length) return v.mangaMap;
      const c = JSON.parse(localStorage.getItem("mangaverse_library_cache") || "{}");
      return c.mangaMap || {};
    } catch {
      return {};
    }
  });
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Search & Sort state within library
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("title");

  // Manage mode state
  const [manageMode, setManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkActionBusy, setBulkActionBusy] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkScore, setBulkScore] = useState("");
  const [bulkAddTag, setBulkAddTag] = useState("");
  const [bulkAddListId, setBulkAddListId] = useState("");
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  // Custom list modals
  const [createListModalOpen, setCreateListModalOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const [editListModalOpen, setEditListModalOpen] = useState(false);
  const [editListName, setEditListName] = useState("");
  const [editListDesc, setEditListDesc] = useState("");
  const [deleteListConfirmOpen, setDeleteListConfirmOpen] = useState(false);
  const [listActionBusy, setListActionBusy] = useState(false);

  // Export modal
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("json");
  const [exportScope, setExportScope] = useState("all");
  const [exportBusy, setExportBusy] = useState(false);

  // Import modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [conflictStrategy, setConflictStrategy] = useState("keep_existing");
  const [importBusy, setImportBusy] = useState(false);
  const [importStatusMessage, setImportStatusMessage] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [incrementingId, setIncrementingId] = useState(null);

  // Keyboard Escape listener to close modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setExportModalOpen(false);
        setImportModalOpen(false);
        setBulkModalOpen(false);
        setCreateListModalOpen(false);
        setEditListModalOpen(false);
        setDeleteListConfirmOpen(false);
        setBulkDeleteConfirmOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Back button handler
  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate("/browse");
    }
  };

  async function handleQuickIncrement(goldId) {
    if (!token || incrementingId === goldId) return;
    setIncrementingId(goldId);
    try {
      const res = await incrementChapter(token, goldId);
      setTrackingEntries((prev) => {
        const exists = prev.some((e) => e.gold_id === goldId);
        if (exists) {
          return prev.map((e) =>
            e.gold_id === goldId
              ? { ...e, progress: res.progress, status: res.status }
              : e
          );
        }
        return [
          ...prev,
          { gold_id: goldId, progress: res.progress, status: res.status, score: null, notes: null },
        ];
      });
      recordVaultTracking(userId, goldId, { progress: res.progress, status: res.status });
    } catch {
      // silent
    } finally {
      setIncrementingId(null);
    }
  }

  // Trigger reload
  const reloadLibrary = () => setReloadTrigger((c) => c + 1);

  useEffect(() => {
    if (authLoading || !token) return undefined;
    let cancelled = false;

    // Only show full-screen spinner if we have zero cached items
    const hasCachedData = trackingEntries.length > 0 || Object.keys(mangaMap).length > 0;
    if (!hasCachedData) {
      setLoading(true);
    }

    Promise.all([
      listTracking(token),
      listFavorites(token),
      listCustomLists(token),
      listAllTags(token),
    ])
      .then(async ([trackData, favData, listsData, tagsData]) => {
        if (cancelled) return;
        const serverTracking = trackData.entries || [];
        const trackingList = await reconcileTrackingWithServer(
          userId,
          serverTracking,
          token,
          saveTracking
        );
        const favSet = new Set((favData.favorites || []).map((f) => f.gold_id));
        const lists = listsData.lists || [];
        const tags = tagsData.tags_by_gold_id || {};

        const listDetails = await Promise.all(
          lists.map((l) => getCustomList(l.id, token).catch(() => null))
        );
        if (cancelled) return;

        const listEntriesMap = {};
        listDetails.filter(Boolean).forEach((d) => {
          listEntriesMap[d.id] = d.entries || [];
        });

        const allGoldIds = new Set([
          ...trackingList.map((t) => t.gold_id),
          ...favSet,
          ...Object.values(listEntriesMap).flat(),
          ...Object.keys(tags),
        ]);

        // Fetch all manga details in a SINGLE fast batch request!
        const byId = await getMangaBatch([...allGoldIds]);
        if (cancelled) return;

        setTrackingEntries(trackingList);
        setFavoriteIds(favSet);
        setCustomLists(lists);
        setCustomListEntries(listEntriesMap);
        setTagsByGoldId(tags);
        const updatedMangaMap = { ...mangaMap, ...byId };
        setMangaMap(updatedMangaMap);

        saveLocalVault(userId, {
          trackingEntries: trackingList,
          favoriteIds: [...favSet],
          customLists: lists,
          customListEntries: listEntriesMap,
          tagsByGoldId: tags,
          mangaMap: updatedMangaMap,
        });

        try {
          localStorage.setItem(
            "mangaverse_library_cache",
            JSON.stringify({
              trackingEntries: trackingList,
              favoriteIds: [...favSet],
              customLists: lists,
              customListEntries: listEntriesMap,
              tagsByGoldId: tags,
              mangaMap: updatedMangaMap,
            })
          );
        } catch {
          // ignore quota
        }
      })
      .catch(() => {
        if (!cancelled && !hasCachedData) setError("Failed to load your library. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, authLoading, reloadTrigger]);

  // Combined library items
  const allLibraryItems = useMemo(() => {
    const trackingById = {};
    trackingEntries.forEach((t) => {
      trackingById[t.gold_id] = t;
    });

    const ids = Object.keys(mangaMap);
    return ids.map((id) => {
      const manga = mangaMap[id];
      const tracking = trackingById[id] || null;
      const isFav = favoriteIds.has(id);
      const tags = tagsByGoldId[id] || [];
      return {
        gold_id: id,
        manga,
        tracking,
        isFav,
        tags,
      };
    });
  }, [mangaMap, trackingEntries, favoriteIds, tagsByGoldId]);

  // Currently viewed custom list object (if activeTab is list:{id})
  const currentCustomList = useMemo(() => {
    if (!activeTab.startsWith("list:")) return null;
    const listId = Number(activeTab.replace("list:", ""));
    return customLists.find((l) => l.id === listId) || null;
  }, [activeTab, customLists]);

  // Filtered and sorted items
  const displayedItems = useMemo(() => {
    let items = allLibraryItems;
    if (activeTab === "all") {
      items = allLibraryItems;
    } else if (activeTab === "favorites") {
      items = allLibraryItems.filter((item) => item.isFav);
    } else if (activeTab.startsWith("status:")) {
      const status = activeTab.replace("status:", "");
      items = allLibraryItems.filter((item) => item.tracking?.status === status);
    } else if (STATUS_TABS.some((t) => t.id === activeTab && t.id !== "all")) {
      items = allLibraryItems.filter((item) => item.tracking?.status === activeTab);
    } else if (activeTab.startsWith("list:")) {
      const listId = Number(activeTab.replace("list:", ""));
      const listEntryGids = new Set(customListEntries[listId] || []);
      items = allLibraryItems.filter((item) => listEntryGids.has(item.gold_id));
    } else if (activeTab.startsWith("tag:")) {
      const tag = activeTab.replace("tag:", "");
      items = allLibraryItems.filter((item) => item.tags.includes(tag));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter((item) => {
        const title = (item.manga?.title || item.gold_id).toLowerCase();
        const notes = (item.tracking?.notes || "").toLowerCase();
        const tags = (item.tags || []).join(" ").toLowerCase();
        return title.includes(q) || notes.includes(q) || tags.includes(q);
      });
    }

    return [...items].sort((a, b) => {
      if (sortBy === "title") {
        const titleA = a.manga?.title || a.gold_id;
        const titleB = b.manga?.title || b.gold_id;
        return titleA.localeCompare(titleB);
      }
      if (sortBy === "progress") {
        return (b.tracking?.progress || 0) - (a.tracking?.progress || 0);
      }
      if (sortBy === "score") {
        return (b.tracking?.score || 0) - (a.tracking?.score || 0);
      }
      if (sortBy === "updated") {
        const dateA = a.tracking?.updated_at ? new Date(a.tracking.updated_at).getTime() : 0;
        const dateB = b.tracking?.updated_at ? new Date(b.tracking.updated_at).getTime() : 0;
        return dateB - dateA;
      }
      return 0;
    });
  }, [allLibraryItems, activeTab, customListEntries, searchQuery, sortBy]);

  // Unique tags across user's library
  const allUniqueTags = useMemo(() => {
    const set = new Set();
    Object.values(tagsByGoldId).forEach((list) => {
      list.forEach((t) => set.add(t));
    });
    return [...set].sort();
  }, [tagsByGoldId]);

  // Manage selection helpers
  const handleToggleSelect = (goldId) => {
    const next = new Set(selectedIds);
    if (next.has(goldId)) next.delete(goldId);
    else next.add(goldId);
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === displayedItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedItems.map((i) => i.gold_id)));
    }
  };

  // Bulk update submission
  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (selectedIds.size === 0) return;
    setBulkActionBusy(true);
    setError("");
    try {
      const payload = {
        gold_ids: [...selectedIds],
        status: bulkStatus || null,
        score: bulkScore !== "" ? Number(bulkScore) : null,
        add_tag: bulkAddTag.trim() || null,
        add_to_list_id: bulkAddListId ? Number(bulkAddListId) : null,
      };
      const res = await bulkUpdateLibrary(payload, token);
      setBulkModalOpen(false);
      setSelectedIds(new Set());
      setManageMode(false);
      setBulkStatus("");
      setBulkScore("");
      setBulkAddTag("");
      setBulkAddListId("");
      setFeedbackMessage(res.message);
      reloadLibrary();
    } catch {
      setError("Failed to execute bulk update. Please try again.");
    } finally {
      setBulkActionBusy(false);
    }
  };

  // Bulk delete submission
  const handleBulkDeleteSubmit = async () => {
    if (selectedIds.size === 0) return;
    setBulkActionBusy(true);
    setError("");
    try {
      const res = await bulkDeleteLibrary([...selectedIds], token);
      setBulkDeleteConfirmOpen(false);
      setBulkModalOpen(false);
      const count = selectedIds.size;
      setSelectedIds(new Set());
      setManageMode(false);
      setFeedbackMessage(res.message || `Successfully removed ${count} titles from library.`);
      reloadLibrary();
    } catch {
      setError("Failed to remove titles from library. Please try again.");
    } finally {
      setBulkActionBusy(false);
    }
  };

  // Custom List Creation handler
  const handleCreateListSubmit = async (e) => {
    e.preventDefault();
    const name = newListName.trim();
    if (!name) return;
    setListActionBusy(true);
    setError("");
    try {
      const created = await createCustomList(
        { name, description: newListDesc.trim() || null },
        token
      );
      setCreateListModalOpen(false);
      setNewListName("");
      setNewListDesc("");
      setFeedbackMessage(`Created custom list "${name}".`);
      setSearchParams({ tab: `list:${created.id}` });
      reloadLibrary();
    } catch {
      setError("Failed to create custom list. Make sure the name is unique.");
    } finally {
      setListActionBusy(false);
    }
  };

  // Custom List Edit handler
  const handleEditListSubmit = async (e) => {
    e.preventDefault();
    if (!currentCustomList) return;
    const name = editListName.trim();
    if (!name) return;
    setListActionBusy(true);
    setError("");
    try {
      await updateCustomList(
        currentCustomList.id,
        { name, description: editListDesc.trim() || null },
        token
      );
      setEditListModalOpen(false);
      setFeedbackMessage(`Updated custom list "${name}".`);
      reloadLibrary();
    } catch {
      setError("Failed to update custom list. Make sure the name is unique.");
    } finally {
      setListActionBusy(false);
    }
  };

  // Custom List Delete handler
  const handleDeleteListConfirm = async () => {
    if (!currentCustomList) return;
    setListActionBusy(true);
    setError("");
    try {
      await deleteCustomList(currentCustomList.id, token);
      setDeleteListConfirmOpen(false);
      setFeedbackMessage(`Deleted custom list "${currentCustomList.name}".`);
      setSearchParams({ tab: "all" });
      reloadLibrary();
    } catch {
      setError("Failed to delete custom list.");
    } finally {
      setListActionBusy(false);
    }
  };

  // Export Download
  const handleExportDownload = async () => {
    setExportBusy(true);
    setError("");
    try {
      let goldIds = null;
      if (exportScope === "selected" && selectedIds.size > 0) {
        goldIds = [...selectedIds].join(",");
      } else if (exportScope === "filtered") {
        goldIds = displayedItems.map((d) => d.gold_id).join(",");
      }

      const res = await downloadLibraryExport(exportFormat, token, {
        scope: exportScope,
        goldIds,
      });

      let mime = "application/json";
      if (exportFormat === "csv") mime = "text/csv;charset=utf-8;";
      else if (exportFormat === "xml") mime = "application/xml;charset=utf-8;";

      const blob = new Blob([res.data], { type: mime });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mangaverse_library_${user?.username || "export"}_${new Date().toISOString().slice(0, 10)}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setExportModalOpen(false);
      setFeedbackMessage(`Library successfully exported as .${exportFormat.toUpperCase()}!`);
    } catch {
      setError("Failed to generate export file. Please verify network connection.");
    } finally {
      setExportBusy(false);
    }
  };

  // File processing for Import
  const processImportFile = async (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".json") && !name.endsWith(".csv") && !name.endsWith(".xml")) {
      setError("Unsupported file format. Please upload a .JSON, .CSV, or .XML file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File exceeds 5MB maximum limit. Please select a smaller file.");
      return;
    }

    setImportFile(file);
    setImportBusy(true);
    setError("");
    setImportPreview(null);
    setImportResult(null);
    setImportStatusMessage("Validating file format and schema…");

    try {
      const preview = await previewImportLibrary(file, token);
      setImportPreview(preview);
      setImportStatusMessage("");
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          "Unable to import this file. The file format is supported, but the data structure is invalid."
      );
      setImportStatusMessage("");
    } finally {
      setImportBusy(false);
    }
  };

  const handleImportFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) processImportFile(file);
  };

  // Drag and Drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processImportFile(file);
  };

  const handleImportCommit = async () => {
    if (!importPreview?.preview_token) return;
    setImportBusy(true);
    setError("");
    setImportStatusMessage("Applying records to your library…");
    try {
      const result = await commitImportLibrary(
        {
          previewToken: importPreview.preview_token,
          conflictStrategy,
        },
        token
      );
      setImportResult(result);
      setFeedbackMessage(result.message);
      reloadLibrary();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to commit import.");
    } finally {
      setImportBusy(false);
      setImportStatusMessage("");
    }
  };

  if (authLoading || (loading && !trackingEntries.length && !favoriteIds.size)) {
    return <LoadingSpinner label="Loading your personal library..." />;
  }

  if (!token) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-3xl font-black text-foreground tracking-tight">My Library</h1>
          <p className="mt-3 text-sm text-muted">
            Sign in to organize your reading lists, track chapter progress, set private tags, and export or import your collection.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block rounded-xl bg-accent px-6 py-3 text-xs font-bold text-accentFg shadow-sm hover:bg-accentHover transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 pb-20 pt-4">
      {/* Back Button & Top Navigation Row */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-surface text-sm font-semibold text-muted hover:text-foreground hover:bg-surfaceHover transition-colors shadow-sm"
          title="Return to previous page"
        >
          <span className="text-base leading-none">←</span>
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setExportModalOpen(true);
              setError("");
            }}
            className="min-h-[42px] px-4 py-2 rounded-xl border border-border bg-surface text-xs font-bold text-foreground hover:bg-surfaceHover hover:border-accent/40 transition-all shadow-sm inline-flex items-center gap-2"
            title="Export personal library to JSON, CSV, or XML"
          >
            <span className="text-base">📤</span>
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setImportModalOpen(true);
              setImportFile(null);
              setImportPreview(null);
              setImportResult(null);
              setError("");
            }}
            className="min-h-[42px] px-4 py-2 rounded-xl border border-border bg-surface text-xs font-bold text-foreground hover:bg-surfaceHover hover:border-accent/40 transition-all shadow-sm inline-flex items-center gap-2"
            title="Import library from JSON, CSV, or XML"
          >
            <span className="text-base">📥</span>
            <span>Import</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setManageMode((v) => !v);
              setSelectedIds(new Set());
            }}
            className={`min-h-[42px] px-4 py-2 rounded-xl border text-xs font-bold transition-all inline-flex items-center gap-2 shadow-sm ${
              manageMode
                ? "border-accent bg-accent text-accentFg font-black shadow-accent/20"
                : "border-border bg-surface text-foreground hover:bg-surfaceHover"
            }`}
          >
            <span className="text-base">⚙️</span>
            <span>{manageMode ? "Exit Manage" : "Manage"}</span>
          </button>
        </div>
      </div>

      {/* Main Page Header */}
      <div className="border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            My Manga Library
          </h1>
          <span className="px-3 py-1 rounded-full bg-accentSoft text-accent font-extrabold text-xs">
            {allLibraryItems.length} titles
          </span>
        </div>
        <p className="text-sm text-muted mt-2 max-w-2xl leading-relaxed">
          Manage your reading progress, organize custom shelves, attach private notes and tags, and freely import or export your collection across JSON, CSV, and XML formats.
        </p>
      </div>

      {/* Global Alert / Feedback Banner */}
      {feedbackMessage && (
        <div className="rounded-2xl border border-accent/40 bg-accentSoft/60 px-5 py-3.5 text-xs font-bold text-accent flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span>{feedbackMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage("")}
            className="text-accent hover:text-foreground font-bold text-base px-1"
          >
            ×
          </button>
        </div>
      )}

      {error && <ErrorMessage message={error} />}

      {/* PROMINENT STATUS / FILTER NAVIGATION BAR */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-surface p-2.5 shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {STATUS_TABS.map((tab) => {
              const count =
                tab.id === "all"
                  ? allLibraryItems.length
                  : allLibraryItems.filter((i) => i.tracking?.status === tab.id).length;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSearchParams({ tab: tab.id })}
                  className={`min-h-[48px] sm:min-h-[52px] px-4 sm:px-5 py-2.5 rounded-xl text-sm font-bold shrink-0 transition-all inline-flex items-center gap-2.5 ${
                    isActive
                      ? "bg-accent text-accentFg shadow-md ring-2 ring-accent/30 font-black"
                      : "bg-surfaceHover/60 text-muted hover:text-foreground hover:bg-surfaceHover border border-border/60"
                  }`}
                >
                  <span className="text-base">{tab.icon}</span>
                  <span>{tab.label}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      isActive ? "bg-black/20 text-accentFg" : "bg-surface text-muted"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setSearchParams({ tab: "favorites" })}
              className={`min-h-[48px] sm:min-h-[52px] px-4 sm:px-5 py-2.5 rounded-xl text-sm font-bold shrink-0 transition-all inline-flex items-center gap-2.5 ${
                activeTab === "favorites"
                  ? "bg-accent text-accentFg shadow-md ring-2 ring-accent/30 font-black"
                  : "bg-surfaceHover/60 text-muted hover:text-foreground hover:bg-surfaceHover border border-border/60"
              }`}
            >
              <span className="text-base">❤️</span>
              <span>Favorites</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === "favorites" ? "bg-black/20 text-accentFg" : "bg-surface text-muted"
                }`}
              >
                {favoriteIds.size}
              </span>
            </button>
          </div>
        </div>

        {/* Secondary Shelves: Custom Lists & Private Tags */}
        <div className="flex flex-wrap items-center gap-2 pt-2 px-1 border-t border-border/40">
          <span className="text-xs font-bold uppercase tracking-wider text-muted mr-1">Lists:</span>
          {customLists.map((lst) => {
            const isActive = activeTab === `list:${lst.id}`;
            const count = customListEntries[lst.id]?.length || 0;
            return (
              <button
                key={lst.id}
                type="button"
                onClick={() => setSearchParams({ tab: `list:${lst.id}` })}
                className={`min-h-[34px] px-3.5 py-1 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-accentSoft text-accent font-bold border border-accent/40 shadow-sm"
                    : "bg-surface text-muted hover:text-foreground border border-border hover:bg-surfaceHover"
                }`}
              >
                {lst.name} ({count})
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setCreateListModalOpen(true)}
            className="min-h-[34px] px-3 py-1 rounded-xl text-xs text-accent font-bold hover:bg-accentSoft/40 transition-colors inline-flex items-center gap-1"
          >
            <span>+</span>
            <span>New List</span>
          </button>

          {allUniqueTags.length > 0 && (
            <>
              <span className="text-border mx-2">|</span>
              <span className="text-xs font-bold uppercase tracking-wider text-muted mr-1">Tags:</span>
              {allUniqueTags.map((tag) => {
                const isActive = activeTab === `tag:${tag}`;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSearchParams({ tab: `tag:${tag}` })}
                    className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-accentSoft text-accent font-bold border border-accent/40 shadow-sm"
                        : "bg-surface text-muted hover:text-foreground border border-border hover:bg-surfaceHover"
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Toolbar: Search & Sort Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-border bg-surface/80 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-sm">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search within library (title, notes, tags)…"
            className="w-full pl-10 pr-9 py-2 rounded-xl border border-border bg-surfaceHover/50 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground font-bold text-sm"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          <label className="text-xs font-semibold text-muted whitespace-nowrap">Sort By:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-border bg-surface text-xs font-semibold text-foreground focus:outline-none focus:border-accent cursor-pointer"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Custom List Details Header Bar (if viewing custom list) */}
      {currentCustomList && (
        <div className="p-4 rounded-2xl border border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-fadeIn">
          <div>
            <h2 className="text-lg font-black text-foreground">{currentCustomList.name}</h2>
            {currentCustomList.description && (
              <p className="text-xs text-muted mt-0.5">{currentCustomList.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditListName(currentCustomList.name);
                setEditListDesc(currentCustomList.description || "");
                setEditListModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl border border-border text-xs font-bold text-muted hover:text-foreground hover:bg-surfaceHover transition-colors"
            >
              Rename / Edit
            </button>
            <button
              type="button"
              onClick={() => setDeleteListConfirmOpen(true)}
              className="px-3.5 py-1.5 rounded-xl border border-red-500/30 text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Delete List
            </button>
          </div>
        </div>
      )}

      {/* Manage Mode Floating Actions Bar */}
      {manageMode && (
        <div className="sticky top-16 z-20 rounded-2xl border border-accent/40 bg-surface/95 backdrop-blur-md p-4 shadow-xl flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-3.5 py-2 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-surfaceHover transition-colors"
            >
              {selectedIds.size === displayedItems.length ? "Deselect All" : "Select All"}
            </button>
            <span className="text-xs font-extrabold text-accent">
              {selectedIds.size} of {displayedItems.length} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={selectedIds.size === 0 || bulkActionBusy}
              onClick={() => setBulkDeleteConfirmOpen(true)}
              className="px-4 py-2 rounded-xl border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all shadow-sm disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              <span>🗑️</span>
              <span>Remove Selected ({selectedIds.size})</span>
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => setBulkModalOpen(true)}
              className="px-5 py-2 rounded-xl bg-accent text-xs font-black text-accentFg hover:bg-accentHover transition-colors shadow-sm disabled:opacity-50"
            >
              Bulk Actions…
            </button>
          </div>
        </div>
      )}

      {/* Manga Grid / Empty States */}
      {displayedItems.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-16 text-center bg-surface/40 space-y-4">
          <div className="text-4xl">📚</div>
          <h3 className="text-lg font-black text-foreground">No titles found in this view</h3>
          <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
            {searchQuery
              ? `No titles match your search "${searchQuery}". Try different keywords or clear the filter.`
              : activeTab === "all"
              ? "Your library is currently empty. Start tracking manga from the catalog or import your existing collection."
              : `You don't have any titles categorized under "${activeTab}".`}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              to="/browse"
              className="px-5 py-2.5 rounded-xl bg-accent text-accentFg text-xs font-bold hover:bg-accentHover transition-colors shadow-sm"
            >
              Browse Catalog
            </Link>
            <button
              type="button"
              onClick={() => {
                setImportModalOpen(true);
                setImportFile(null);
                setImportPreview(null);
                setImportResult(null);
              }}
              className="px-5 py-2.5 rounded-xl border border-border bg-surface text-xs font-bold text-foreground hover:bg-surfaceHover transition-colors"
            >
              Import Library
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
          {displayedItems.map((item) => {
            const isSelected = selectedIds.has(item.gold_id);
            return (
              <div
                key={item.gold_id}
                className={`relative group rounded-2xl border bg-surface overflow-hidden transition-all flex flex-col shadow-sm ${
                  isSelected
                    ? "border-accent ring-2 ring-accent/40 shadow-lg"
                    : "border-border hover:border-accent/50 hover:shadow-md"
                }`}
              >
                {/* Manage Mode Checkbox */}
                {manageMode && (
                  <div className="absolute top-2.5 left-2.5 z-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(item.gold_id)}
                      className="w-5 h-5 rounded-lg border-2 border-border text-accent focus:ring-accent accent-accent cursor-pointer bg-black/80"
                    />
                  </div>
                )}

                {/* Cover Poster */}
                <Link
                  to={`/manga/${encodeURIComponent(item.gold_id)}`}
                  className="aspect-[3/4] w-full bg-surfaceHover overflow-hidden block relative"
                >
                  {item.manga?.cover_image_url ? (
                    <img
                      src={item.manga.cover_image_url}
                      alt={item.manga?.title || "Manga cover"}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted font-bold text-3xl">
                      📖
                    </div>
                  )}

                  {/* Rating / Status badge overlays */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-extrabold text-white drop-shadow-md">
                    {item.tracking?.status && (
                      <span className="px-2 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm uppercase">
                        {item.tracking.status}
                      </span>
                    )}
                    {item.tracking?.score != null && (
                      <span className="px-2 py-0.5 rounded-lg bg-black/75 backdrop-blur-sm text-accent">
                        ★ {item.tracking.score}
                      </span>
                    )}
                  </div>
                </Link>

                {/* Title & Actions */}
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                  <Link
                    to={`/manga/${encodeURIComponent(item.gold_id)}`}
                    className="text-xs font-black text-foreground group-hover:text-accent transition-colors line-clamp-2 leading-snug"
                    title={item.manga?.title || item.gold_id}
                  >
                    {item.manga?.title || item.gold_id}
                  </Link>

                  <div className="space-y-2">
                    {/* Tags preview */}
                    {item.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.tags.slice(0, 2).map((t) => (
                          <span
                            key={t}
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surfaceHover text-muted"
                          >
                            #{t}
                          </span>
                        ))}
                        {item.tags.length > 2 && (
                          <span className="text-[10px] text-muted">+{item.tags.length - 2}</span>
                        )}
                      </div>
                    )}

                    {/* Progress counter & quick +1 */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <div className="text-[11px] font-bold text-muted">
                        Ch. <span className="text-foreground">{item.tracking?.progress || 0}</span>
                      </div>
                      <button
                        type="button"
                        disabled={incrementingId === item.gold_id}
                        onClick={() => handleQuickIncrement(item.gold_id)}
                        className="min-h-[36px] min-w-[40px] px-2.5 py-1 rounded-xl bg-accentSoft hover:bg-accent hover:text-accentFg text-accent font-black text-xs transition-colors shadow-sm disabled:opacity-50"
                        title="Increment read progress by +1 chapter"
                      >
                        {incrementingId === item.gold_id ? "…" : "+1"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* EXPORT MODAL (JSON, CSV, XML with Scoping) */}
      {exportModalOpen && (
        <div
          onClick={() => setExportModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-2xl space-y-5"
          >
            <div className="border-b border-border pb-3">
              <h3 className="text-xl font-black text-foreground">Export Library</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Download your personal reading records, ratings, chapter progress, custom lists, and tags. All formats are verified and round-trip compatible.
              </p>
            </div>

            {/* Format Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-muted uppercase tracking-wider">
                Choose Format
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: "json", label: "JSON", desc: "Structured & complete" },
                  { id: "csv", label: "CSV", desc: "Spreadsheet ready" },
                  { id: "xml", label: "XML", desc: "Standard XML schema" },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setExportFormat(fmt.id)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      exportFormat === fmt.id
                        ? "border-accent bg-accentSoft/60 text-accent ring-2 ring-accent/30 font-bold"
                        : "border-border bg-surfaceHover/40 text-muted hover:text-foreground hover:bg-surfaceHover"
                    }`}
                  >
                    <div className="font-extrabold text-foreground text-sm">{fmt.label}</div>
                    <div className="text-[10px] text-muted mt-0.5">{fmt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Scope Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-muted uppercase tracking-wider">
                Export Scope
              </label>
              <div className="space-y-2">
                <label className="flex items-center justify-between p-3 rounded-2xl border border-border bg-surfaceHover/30 cursor-pointer hover:border-accent/40">
                  <div className="text-xs">
                    <span className="font-bold text-foreground">All Titles</span>
                    <span className="text-muted ml-1.5">({allLibraryItems.length} total)</span>
                  </div>
                  <input
                    type="radio"
                    name="exportScope"
                    value="all"
                    checked={exportScope === "all"}
                    onChange={() => setExportScope("all")}
                    className="accent-accent w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-2xl border border-border bg-surfaceHover/30 cursor-pointer hover:border-accent/40">
                  <div className="text-xs">
                    <span className="font-bold text-foreground">Current Filter</span>
                    <span className="text-muted ml-1.5">({displayedItems.length} titles)</span>
                  </div>
                  <input
                    type="radio"
                    name="exportScope"
                    value="filtered"
                    checked={exportScope === "filtered"}
                    onChange={() => setExportScope("filtered")}
                    className="accent-accent w-4 h-4"
                  />
                </label>

                {selectedIds.size > 0 && (
                  <label className="flex items-center justify-between p-3 rounded-2xl border border-border bg-surfaceHover/30 cursor-pointer hover:border-accent/40">
                    <div className="text-xs">
                      <span className="font-bold text-foreground">Selected Titles</span>
                      <span className="text-muted ml-1.5">({selectedIds.size} selected)</span>
                    </div>
                    <input
                      type="radio"
                      name="exportScope"
                      value="selected"
                      checked={exportScope === "selected"}
                      onChange={() => setExportScope("selected")}
                      className="accent-accent w-4 h-4"
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={exportBusy}
                onClick={handleExportDownload}
                className="px-6 py-2.5 rounded-xl bg-accent text-xs font-black text-accentFg hover:bg-accentHover disabled:opacity-50 inline-flex items-center gap-2 shadow-sm"
              >
                <span>{exportBusy ? "Exporting…" : `Export as .${exportFormat.toUpperCase()}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT MODAL (JSON, CSV, XML with Drag & Drop, Validation & Preview) */}
      {importModalOpen && (
        <div
          onClick={() => setImportModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl border border-border bg-surface p-6 shadow-2xl space-y-5"
          >
            <div className="border-b border-border pb-3">
              <h3 className="text-xl font-black text-foreground">Import Library</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Import your MangaVerse reading lists from a JSON, CSV, or XML file. All imports run a preview dry-run first so your existing library is protected.
              </p>
            </div>

            {/* Step 1: Drag & Drop / File Picker */}
            {!importPreview && !importResult && (
              <div className="space-y-4">
                <div
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`rounded-3xl border-2 border-dashed p-8 text-center transition-all ${
                    isDragging
                      ? "border-accent bg-accentSoft/40 ring-4 ring-accent/20 scale-[1.01]"
                      : "border-border bg-surfaceHover/30 hover:border-accent/40"
                  }`}
                >
                  <div className="text-4xl mb-2">📥</div>
                  <h4 className="text-sm font-bold text-foreground">
                    {isDragging ? "Drop your file here!" : "Drag & Drop File Here"}
                  </h4>
                  <p className="text-xs text-muted mt-1">or click below to choose a file</p>

                  <div className="mt-4">
                    <label className="cursor-pointer inline-block">
                      <span className="px-5 py-2.5 rounded-xl bg-accent text-accentFg text-xs font-black hover:bg-accentHover transition-colors shadow-sm inline-flex items-center gap-2">
                        <span>Choose File</span>
                      </span>
                      <input
                        type="file"
                        accept=".json,.csv,.xml"
                        onChange={handleImportFileSelect}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-center gap-2 text-xs text-muted">
                    <span className="font-bold">Supported:</span>
                    <span className="px-2 py-0.5 rounded bg-surface border border-border text-[11px] font-bold text-foreground">
                      JSON
                    </span>
                    <span className="px-2 py-0.5 rounded bg-surface border border-border text-[11px] font-bold text-foreground">
                      CSV
                    </span>
                    <span className="px-2 py-0.5 rounded bg-surface border border-border text-[11px] font-bold text-foreground">
                      XML
                    </span>
                  </div>
                  <p className="text-[11px] text-muted mt-1.5">Maximum file size: 5MB (up to 2,000 titles)</p>
                </div>

                {importBusy && (
                  <div className="text-center py-2 space-y-1">
                    <div className="inline-block animate-spin text-xl">⏳</div>
                    <p className="text-xs font-bold text-accent">
                      {importStatusMessage || "Validating file and preparing preview…"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Dry Run Validation & Preview */}
            {importPreview && !importResult && (
              <div className="space-y-4">
                {importFile && (
                  <div className="p-3 rounded-2xl bg-surfaceHover/50 border border-border flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-foreground">{importFile.name}</span>
                      <span className="text-muted ml-2">({(importFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-accentSoft text-accent font-extrabold uppercase text-[10px]">
                      {importPreview.source_format}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3.5 rounded-2xl bg-surfaceHover/60 border border-border">
                    <div className="text-2xl font-black text-accent">{importPreview.valid_rows}</div>
                    <div className="text-[10px] text-muted uppercase tracking-wider font-extrabold mt-0.5">
                      ✓ Valid Titles
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-surfaceHover/60 border border-border">
                    <div className="text-2xl font-black text-foreground">
                      {importPreview.conflicts_count}
                    </div>
                    <div className="text-[10px] text-muted uppercase tracking-wider font-extrabold mt-0.5">
                      ⚠ Conflicts
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-surfaceHover/60 border border-border">
                    <div className="text-2xl font-black text-muted">
                      {importPreview.skipped_rows?.length || 0}
                    </div>
                    <div className="text-[10px] text-muted uppercase tracking-wider font-extrabold mt-0.5">
                      ✕ Skipped
                    </div>
                  </div>
                </div>

                {/* Conflict Resolution Strategy */}
                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                    Conflict Resolution Policy
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 p-3 rounded-2xl border border-border bg-surfaceHover/30 cursor-pointer hover:border-accent/40 transition-colors">
                      <input
                        type="radio"
                        name="conflictStrategy"
                        value="keep_existing"
                        checked={conflictStrategy === "keep_existing"}
                        onChange={() => setConflictStrategy("keep_existing")}
                        className="mt-0.5 accent-accent w-4 h-4"
                      />
                      <div className="text-xs">
                        <span className="font-extrabold text-foreground">
                          Keep Existing (Recommended)
                        </span>
                        <p className="text-muted text-[11px] mt-0.5 leading-relaxed">
                          Preserves your existing scores, notes, and progress; only imports missing titles.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-2xl border border-border bg-surfaceHover/30 cursor-pointer hover:border-accent/40 transition-colors">
                      <input
                        type="radio"
                        name="conflictStrategy"
                        value="replace_existing"
                        checked={conflictStrategy === "replace_existing"}
                        onChange={() => setConflictStrategy("replace_existing")}
                        className="mt-0.5 accent-accent w-4 h-4"
                      />
                      <div className="text-xs">
                        <span className="font-extrabold text-foreground">Replace Existing</span>
                        <p className="text-muted text-[11px] mt-0.5 leading-relaxed">
                          Overwrites conflicting progress and scores with the values in the imported file.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex justify-between items-center pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setImportPreview(null);
                      setImportFile(null);
                    }}
                    className="text-xs font-bold text-muted hover:text-foreground inline-flex items-center gap-1"
                  >
                    <span>←</span>
                    <span>Choose Different File</span>
                  </button>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => setImportModalOpen(false)}
                      className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-muted hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={importBusy || importPreview.valid_rows === 0}
                      onClick={handleImportCommit}
                      className="px-5 py-2 rounded-xl bg-accent text-xs font-black text-accentFg hover:bg-accentHover disabled:opacity-50 inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <span>
                        {importBusy ? "Importing…" : `Import ${importPreview.valid_rows} Titles`}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Success Confirmation */}
            {importResult && (
              <div className="text-center py-6 space-y-3">
                <div className="text-4xl">🎉</div>
                <h4 className="text-lg font-black text-foreground">Import Complete!</h4>
                <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
                  {importResult.message}
                </p>
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => setImportModalOpen(false)}
                    className="px-6 py-2.5 rounded-xl bg-accent text-xs font-black text-accentFg hover:bg-accentHover shadow-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BULK ACTION MODAL */}
      {bulkModalOpen && (
        <div
          onClick={() => setBulkModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-lg font-black text-foreground">
              Bulk Update ({selectedIds.size} titles)
            </h3>
            <form onSubmit={handleBulkSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-muted">Change Status</label>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-surfaceHover/50 text-xs text-foreground focus:outline-none focus:border-accent"
                >
                  <option value="">(No change)</option>
                  <option value="reading">Reading</option>
                  <option value="completed">Completed</option>
                  <option value="planning">Planning</option>
                  <option value="paused">Paused</option>
                  <option value="dropped">Dropped</option>
                  <option value="re_reading">Re-reading</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-muted">Set Score (0–10)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={bulkScore}
                  onChange={(e) => setBulkScore(e.target.value)}
                  placeholder="Leave empty for no change"
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-surfaceHover/50 text-xs text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-muted">Add Private Tag</label>
                <input
                  type="text"
                  value={bulkAddTag}
                  onChange={(e) => setBulkAddTag(e.target.value)}
                  placeholder="e.g. masterpiece, physical-copy"
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-surfaceHover/50 text-xs text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              {customLists.length > 0 && (
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-muted">Add to Custom List</label>
                  <select
                    value={bulkAddListId}
                    onChange={(e) => setBulkAddListId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-border bg-surfaceHover/50 text-xs text-foreground focus:outline-none focus:border-accent"
                  >
                    <option value="">(None)</option>
                    {customLists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setBulkModalOpen(false);
                    setBulkDeleteConfirmOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all inline-flex items-center gap-1.5"
                >
                  <span>🗑️</span>
                  <span>Remove from Library</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-muted hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bulkActionBusy}
                    className="px-5 py-2 rounded-xl bg-accent text-xs font-black text-accentFg hover:bg-accentHover disabled:opacity-50 shadow-sm"
                  >
                    {bulkActionBusy ? "Applying…" : "Apply to Selected"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CUSTOM LIST MODAL */}
      {createListModalOpen && (
        <div
          onClick={() => setCreateListModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border border-border bg-surface p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-lg font-black text-foreground">Create Custom List</h3>
            <form onSubmit={handleCreateListSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-muted">List Name</label>
                <input
                  type="text"
                  required
                  maxLength={64}
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g. All-Time Favorites"
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-surfaceHover/50 text-xs text-foreground focus:outline-none focus:border-accent"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-muted">Description (Optional)</label>
                <textarea
                  rows={2}
                  maxLength={256}
                  value={newListDesc}
                  onChange={(e) => setNewListDesc(e.target.value)}
                  placeholder="Short note about this list"
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-surfaceHover/50 text-xs text-foreground focus:outline-none focus:border-accent resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCreateListModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={listActionBusy}
                  className="px-5 py-2 rounded-xl bg-accent text-xs font-black text-accentFg hover:bg-accentHover disabled:opacity-50 shadow-sm"
                >
                  {listActionBusy ? "Creating…" : "Create List"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CUSTOM LIST MODAL */}
      {editListModalOpen && currentCustomList && (
        <div
          onClick={() => setEditListModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border border-border bg-surface p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-lg font-black text-foreground">Edit List Details</h3>
            <form onSubmit={handleEditListSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-muted">List Name</label>
                <input
                  type="text"
                  required
                  maxLength={64}
                  value={editListName}
                  onChange={(e) => setEditListName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-surfaceHover/50 text-xs text-foreground focus:outline-none focus:border-accent"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-muted">Description (Optional)</label>
                <textarea
                  rows={2}
                  maxLength={256}
                  value={editListDesc}
                  onChange={(e) => setEditListDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-border bg-surfaceHover/50 text-xs text-foreground focus:outline-none focus:border-accent resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditListModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={listActionBusy}
                  className="px-5 py-2 rounded-xl bg-accent text-xs font-black text-accentFg hover:bg-accentHover disabled:opacity-50 shadow-sm"
                >
                  {listActionBusy ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CUSTOM LIST CONFIRMATION MODAL */}
      {deleteListConfirmOpen && currentCustomList && (
        <div
          onClick={() => setDeleteListConfirmOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border border-border bg-surface p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-black text-foreground">
              Delete "{currentCustomList.name}"?
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              This will remove the custom list. The manga titles themselves and your reading progress will remain safely in your library.
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setDeleteListConfirmOpen(false)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={listActionBusy}
                onClick={handleDeleteListConfirm}
                className="px-5 py-2 rounded-xl bg-red-600 text-xs font-black text-white hover:bg-red-700 disabled:opacity-50 shadow-sm"
              >
                {listActionBusy ? "Deleting…" : "Yes, Delete List"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK REMOVE CONFIRMATION MODAL */}
      {bulkDeleteConfirmOpen && (
        <div
          onClick={() => setBulkDeleteConfirmOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border border-red-500/30 bg-surface p-6 shadow-2xl space-y-4 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 text-2xl flex items-center justify-center mx-auto">
              🗑️
            </div>
            <h3 className="text-lg font-black text-foreground">
              Remove {selectedIds.size} Titles?
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Are you sure you want to remove {selectedIds.size} {selectedIds.size === 1 ? "manga" : "mangas"} from your library?
              This will remove your reading tracking, scores, and private tags for these titles.
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setBulkDeleteConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-xs font-bold text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkActionBusy}
                onClick={handleBulkDeleteSubmit}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black transition-colors shadow-sm disabled:opacity-50"
              >
                {bulkActionBusy ? "Removing…" : "Yes, Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
