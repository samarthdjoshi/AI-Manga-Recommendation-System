/**
 * Offline-First Library Vault
 * 
 * Guarantees that bookmarks, reading progress, scores, and custom lists
 * are never lost even if the remote server restarts, wipes an ephemeral database,
 * or experiences network interruptions.
 * 
 * Works by maintaining a persistent client-side vault in localStorage per user,
 * instantly rendering on page load (0ms), and automatically reconciling & healing
 * the backend database whenever discrepancies are detected.
 */

const VAULT_KEY_PREFIX = "mangaverse_library_vault_";

function getVaultKey(userId) {
  const id = userId || "guest";
  return `${VAULT_KEY_PREFIX}${id}`;
}

export function getLocalVault(userId) {
  try {
    const raw = localStorage.getItem(getVaultKey(userId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn("[vault] Error reading local vault:", err);
    return null;
  }
}

export function saveLocalVault(userId, data) {
  try {
    const key = getVaultKey(userId);
    const existing = getLocalVault(userId) || {};
    const merged = {
      ...existing,
      ...data,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(merged));
    return merged;
  } catch (err) {
    console.warn("[vault] Error saving local vault:", err);
    return null;
  }
}

/**
 * Record a tracking update directly into the local vault immediately.
 */
export function recordVaultTracking(userId, goldId, trackingData, mangaData = null) {
  try {
    const vault = getLocalVault(userId) || { trackingEntries: [], mangaMap: {} };
    const entries = [...(vault.trackingEntries || [])];
    const idx = entries.findIndex((e) => e.gold_id === goldId);

    const updatedEntry = {
      gold_id: goldId,
      status: trackingData.status,
      progress: trackingData.progress ?? 0,
      score: trackingData.score ?? null,
      notes: trackingData.notes ?? null,
      last_updated: Date.now(),
    };

    if (idx >= 0) {
      entries[idx] = { ...entries[idx], ...updatedEntry };
    } else {
      entries.push(updatedEntry);
    }

    const mangaMap = { ...(vault.mangaMap || {}) };
    if (mangaData) {
      mangaMap[goldId] = mangaData;
    }

    saveLocalVault(userId, {
      trackingEntries: entries,
      mangaMap,
    });
  } catch (err) {
    console.warn("[vault] Error recording tracking:", err);
  }
}

/**
 * Remove a tracking entry from the local vault (e.g. on explicit delete).
 */
export function removeVaultTracking(userId, goldId) {
  try {
    const vault = getLocalVault(userId);
    if (!vault) return;
    const entries = (vault.trackingEntries || []).filter((e) => e.gold_id !== goldId);
    const mangaMap = { ...(vault.mangaMap || {}) };
    delete mangaMap[goldId];
    saveLocalVault(userId, { trackingEntries: entries, mangaMap });
  } catch (err) {
    console.warn("[vault] Error removing tracking from vault:", err);
  }
}

/**
 * Reconciles server tracking data with the local vault:
 * 1. Merges entries from server and local vault.
 * 2. If the local vault contains entries missing on the server (e.g. server reset),
 *    keeps them in the UI and automatically heals/re-uploads them to the server.
 * 3. Returns the complete, healed array of tracking entries.
 */
export async function reconcileTrackingWithServer(
  userId,
  serverEntries = [],
  token = null,
  saveTrackingFn = null
) {
  const vault = getLocalVault(userId);
  if (!vault || !Array.isArray(vault.trackingEntries) || vault.trackingEntries.length === 0) {
    // No local vault yet - initialize it with server data
    if (serverEntries.length > 0) {
      saveLocalVault(userId, { trackingEntries: serverEntries });
    }
    return serverEntries;
  }

  const serverByGoldId = new Map();
  serverEntries.forEach((e) => {
    if (e && e.gold_id) serverByGoldId.set(e.gold_id, e);
  });

  const mergedEntries = [];
  const missingOnServer = [];

  // Inspect local vault entries
  for (const localEntry of vault.trackingEntries) {
    if (!localEntry || !localEntry.gold_id) continue;
    const serverEntry = serverByGoldId.get(localEntry.gold_id);

    if (!serverEntry) {
      // Missing on server (e.g. server restarted or lost database)!
      // Keep it in UI and queue for healing upload
      mergedEntries.push(localEntry);
      missingOnServer.push(localEntry);
    } else {
      // Exists in both - take whichever has higher progress or server version
      const preferred = {
        ...serverEntry,
        // If local has higher progress, preserve local
        progress: Math.max(localEntry.progress || 0, serverEntry.progress || 0),
        status: serverEntry.status || localEntry.status,
        score: serverEntry.score ?? localEntry.score,
        notes: serverEntry.notes ?? localEntry.notes,
      };
      mergedEntries.push(preferred);
      serverByGoldId.delete(localEntry.gold_id);
    }
  }

  // Any remaining server entries that were not in local vault
  for (const remainingServerEntry of serverByGoldId.values()) {
    mergedEntries.push(remainingServerEntry);
  }

  // Update vault with the consolidated result
  saveLocalVault(userId, { trackingEntries: mergedEntries });

  // Self-Healing: In background, re-upload any entries missing on the server
  if (token && typeof saveTrackingFn === "function" && missingOnServer.length > 0) {
    console.log(`[vault] Auto-healing ${missingOnServer.length} missing titles to server database...`);
    Promise.allSettled(
      missingOnServer.map((entry) =>
        saveTrackingFn(
          entry.gold_id,
          {
            status: entry.status || "reading",
            progress: entry.progress || 0,
            score: entry.score,
            notes: entry.notes,
          },
          token
        )
      )
    ).catch((err) => {
      console.warn("[vault] Auto-healing batch error:", err);
    });
  }

  return mergedEntries;
}
