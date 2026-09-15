import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
});

const chatClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90000,
});

// High-performance in-memory cache & request deduplication
const apiCache = new Map();
const inFlightRequests = new Map();

export function clearApiCache(prefix = "") {
  if (!prefix) {
    apiCache.clear();
    return;
  }
  for (const key of apiCache.keys()) {
    if (key.startsWith(prefix)) {
      apiCache.delete(key);
    }
  }
}

export async function cachedGet(url, config = {}, ttlMs = 300000) {
  let paramsKey = "";
  if (config.params) {
    if (config.params instanceof URLSearchParams) {
      paramsKey = config.params.toString();
    } else if (typeof config.params === "object") {
      try {
        const usp = new URLSearchParams();
        for (const [k, v] of Object.entries(config.params)) {
          if (v != null) {
            if (Array.isArray(v)) {
              v.forEach((val) => usp.append(k, val));
            } else {
              usp.append(k, v);
            }
          }
        }
        paramsKey = usp.toString();
      } catch {
        paramsKey = JSON.stringify(config.params);
      }
    } else {
      paramsKey = String(config.params);
    }
  }
  const authHeader = config.headers?.Authorization || "";
  const cacheKey = `${url}?${paramsKey}#${authHeader}`;
  const now = Date.now();

  const cached = apiCache.get(cacheKey);
  if (cached && now - cached.timestamp < ttlMs) {
    return cached.data;
  }

  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const promise = client
    .get(url, config)
    .then((response) => {
      apiCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
      inFlightRequests.delete(cacheKey);
      return response.data;
    })
    .catch((error) => {
      inFlightRequests.delete(cacheKey);
      throw error;
    });

  inFlightRequests.set(cacheKey, promise);
  return promise;
}

export async function checkHealth() {
  const response = await client.get("/health");
  return response.data;
}

export async function searchManga(query, limit = 12) {
  if (!query || !query.trim()) return { query: "", count: 0, results: [] };
  return cachedGet("/search", { params: { q: query, limit } }, 120000);
}

export async function getManga(goldId) {
  return cachedGet(`/manga/${encodeURIComponent(goldId)}`, {}, 600000);
}

export async function getMangaBatch(goldIds) {
  if (!goldIds || goldIds.length === 0) return {};
  const needed = [];
  const results = {};

  for (const id of goldIds) {
    const cacheKey = `/manga/${encodeURIComponent(id)}?#`;
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 600000) {
      results[id] = cached.data;
    } else {
      needed.push(id);
    }
  }

  if (needed.length === 0) return results;

  try {
    const response = await client.post("/manga/batch", { gold_ids: needed });
    const batchResults = response.data?.results || {};
    for (const [id, data] of Object.entries(batchResults)) {
      results[id] = data;
      apiCache.set(`/manga/${encodeURIComponent(id)}?#`, { data, timestamp: Date.now() });
    }
  } catch (err) {
    console.error("Batch manga fetch error:", err);
  }

  return results;
}

export async function getRecommendations(goldId, topK = 10) {
  return cachedGet(`/recommend/${encodeURIComponent(goldId)}`, { params: { top_k: topK } }, 600000);
}

export async function getDiscover(sort = "rating", limit = 12) {
  return cachedGet("/discover", { params: { sort, limit } }, 300000);
}

export async function getSuggestions(query, limit = 6, options = {}) {
  if (!query || !query.trim()) return { query: "", results: [] };
  const response = await client.get("/search/suggest", {
    params: { q: query, limit },
    ...options,
  });
  return response.data;
}

export async function browseManga({
  q,
  genres = [],
  excludeGenres = [],
  status,
  yearMin,
  yearMax,
  minChapters,
  maxChapters,
  minRating,
  minSources,
  hasOfficialLinks,
  genreMatch = "and",
  hideExplicit = true,
  hideDoujinshi = true,
  sort = "rating",
  limit = 24,
  offset = 0,
} = {}) {
  const params = new URLSearchParams();
  if (q && q.trim()) params.append("q", q.trim());
  genres.forEach((g) => params.append("genre", g));
  excludeGenres.forEach((g) => params.append("exclude_genre", g));
  if (status) params.append("status", status);
  if (yearMin != null) params.append("year_min", yearMin);
  if (yearMax != null) params.append("year_max", yearMax);
  if (minChapters != null) params.append("min_chapters", minChapters);
  if (maxChapters != null) params.append("max_chapters", maxChapters);
  if (minRating != null) params.append("min_rating", minRating);
  if (minSources != null) params.append("min_sources", minSources);
  if (hasOfficialLinks != null) params.append("has_official_links", hasOfficialLinks ? "true" : "false");
  if (genreMatch !== "and") params.append("genre_match", genreMatch);
  if (!hideExplicit) params.append("hide_explicit", "false");
  if (!hideDoujinshi) params.append("hide_doujinshi", "false");
  params.append("sort", sort);
  params.append("limit", limit);
  params.append("offset", offset);

  return cachedGet("/browse", { params }, 30000);
}

export async function getGenres() {
  return cachedGet("/genres", {}, 1800000);
}

// --- Auth ---

export async function registerUser({ email, username, password }) {
  const response = await client.post("/auth/register", { email, username, password });
  return response.data;
}

export async function loginUser({ email, password }) {
  const loginIdentifier = email ? email.trim() : "";
  const response = await client.post("/auth/login", {
    email: loginIdentifier,
    username: loginIdentifier,
    password,
  });
  return response.data;
}

export async function resetPassword({ email, newPassword }) {
  const identifier = email ? email.trim() : "";
  const response = await client.post("/auth/reset-password", {
    email: identifier,
    username: identifier,
    new_password: newPassword,
  });
  return response.data;
}

export async function getMe(token) {
  const response = await client.get("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

// --- Favorites ---

export async function addFavorite(goldId, token) {
  const response = await client.post(
    `/auth/favorites/${encodeURIComponent(goldId)}`,
    null,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

export async function removeFavorite(goldId, token) {
  await client.delete(`/auth/favorites/${encodeURIComponent(goldId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function listFavorites(token) {
  const response = await client.get("/auth/favorites", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

// --- Tracking ---

export async function listTracking(token) {
  const response = await client.get("/auth/tracking", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export async function saveTracking(goldId, tracking, token) {
  const response = await client.put(
    `/auth/tracking/${encodeURIComponent(goldId)}`,
    tracking,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

export async function removeTracking(goldId, token) {
  await client.delete(`/auth/tracking/${encodeURIComponent(goldId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// --- Custom Lists ---

export async function listCustomLists(token) {
  const response = await client.get("/auth/lists", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export async function createCustomList({ name, description }, token) {
  const response = await client.post(
    "/auth/lists",
    { name, description },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

export async function getCustomList(listId, token) {
  const response = await client.get(`/auth/lists/${listId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export async function updateCustomList(listId, { name, description }, token) {
  const response = await client.patch(
    `/auth/lists/${listId}`,
    { name, description },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

export async function deleteCustomList(listId, token) {
  await client.delete(`/auth/lists/${listId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function addEntryToCustomList(listId, goldId, token) {
  await client.post(
    `/auth/lists/${listId}/entries/${encodeURIComponent(goldId)}`,
    null,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function removeEntryFromCustomList(listId, goldId, token) {
  await client.delete(
    `/auth/lists/${listId}/entries/${encodeURIComponent(goldId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

// --- Private Tags ---

export async function listAllTags(token) {
  const response = await client.get("/auth/tags", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export async function getTagsForManga(goldId, token) {
  const response = await client.get(`/auth/tags/${encodeURIComponent(goldId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export async function setTagsForManga(goldId, tags, token) {
  const response = await client.put(
    `/auth/tags/${encodeURIComponent(goldId)}`,
    { tags },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

export async function deleteTagForManga(goldId, tag, token) {
  await client.delete(
    `/auth/tags/${encodeURIComponent(goldId)}/${encodeURIComponent(tag)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

// --- Bulk Edit ---

export async function bulkUpdateLibrary(payload, token) {
  const response = await client.post("/auth/library/bulk", payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  clearApiCache();
  return response.data;
}

export async function bulkDeleteLibrary(goldIds, token) {
  const response = await client.post(
    "/auth/library/bulk-delete",
    { gold_ids: goldIds },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  clearApiCache();
  return response.data;
}

// --- Import & Export ---

export async function downloadLibraryExport(format, token, { scope = "all", goldIds = null } = {}) {
  const params = { format, scope };
  if (goldIds) params.gold_ids = goldIds;
  const response = await client.get("/auth/library/export", {
    params,
    headers: { Authorization: `Bearer ${token}` },
    responseType: "blob",
  });
  return response;
}

export async function previewImportLibrary(file, token) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await client.post("/auth/library/import/preview", formData, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
}

export async function commitImportLibrary({ previewToken, conflictStrategy }, token) {
  const response = await client.post(
    "/auth/library/import/commit",
    {
      preview_token: previewToken,
      conflict_strategy: conflictStrategy,
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

export async function getRecommendationsForMe(token, topK = 60) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return cachedGet("/recommend/for-me", { params: { top_k: topK }, headers }, 120000);
}

// --- Chat ---

export async function sendChatMessage(
  message,
  history = [],
  hideExplicit = true,
  hideDoujinshi = true,
  pageContextGoldId = null,
  signal = null
) {
  const authToken = localStorage.getItem("token");
  const response = await chatClient.post(
    "/chat",
    {
      message,
      history,
      hide_explicit: hideExplicit,
      hide_doujinshi: hideDoujinshi,
      page_context_gold_id: pageContextGoldId,
    },
    {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      signal,
    }
  );
  return response.data;
}

// --- Live Internet Discovery Feeds ---

export async function getTrendingManga(limit = 20, page = 1) {
  return cachedGet("/discovery/trending", { params: { limit, page } }, 300000);
}

export async function getPopularManga(limit = 20, page = 1) {
  return cachedGet("/discovery/popular", { params: { limit, page } }, 300000);
}

export async function getTop100Manga(limit = 100, page = 1) {
  return cachedGet("/discovery/top-100", { params: { limit, page } }, 600000);
}

export async function getPopularManhwa(limit = 20, page = 1) {
  return cachedGet("/discovery/manhwa", { params: { limit, page } }, 300000);
}

// --- AniList-Style Profile, Activity & Social APIs ---

export async function getMyProfile(token) {
  const response = await client.get("/auth/profile/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export async function updateMyProfile(token, profileData) {
  const response = await client.patch("/auth/profile/me", profileData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export const updateProfile = updateMyProfile;

export async function getPublicProfile(username, token = null) {
  const response = await client.get(`/auth/users/${encodeURIComponent(username)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
}

export async function toggleFollowUser(token, username) {
  const response = await client.post(
    `/auth/users/${encodeURIComponent(username)}/follow`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

export async function getUserFollowers(username, token = null) {
  const response = await client.get(`/auth/users/${encodeURIComponent(username)}/followers`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
}

export async function getUserFollowing(username, token = null) {
  const response = await client.get(`/auth/users/${encodeURIComponent(username)}/following`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
}

export async function listActivities({ feed = "global", username = null, limit = 20, offset = 0, token = null } = {}) {
  const params = { feed, limit, offset };
  if (username) params.username = username;
  const response = await client.get("/auth/activities", {
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return response.data;
}

export async function createTextActivity(token, text) {
  const response = await client.post(
    "/auth/activities",
    { text },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

export async function deleteActivity(token, activityId) {
  await client.delete(`/auth/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function toggleLikeActivity(token, activityId) {
  const response = await client.post(
    `/auth/activities/${activityId}/like`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

export async function createActivityReply(token, activityId, text) {
  const response = await client.post(
    `/auth/activities/${activityId}/replies`,
    { text },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

export async function deleteActivityReply(token, activityId, replyId) {
  await client.delete(`/auth/activities/${activityId}/replies/${replyId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function listNotifications(token, limit = 30) {
  const response = await client.get("/auth/notifications", {
    params: { limit },
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export async function markNotificationsReadAll(token) {
  const response = await client.post(
    "/auth/notifications/read-all",
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

export async function deleteNotification(token, notificationId) {
  await client.delete(`/auth/notifications/${notificationId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function incrementChapter(token, goldId) {
  const response = await client.post(
    `/auth/tracking/${encodeURIComponent(goldId)}/increment`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

export async function changePassword(token, currentPassword, newPassword) {
  const response = await client.post(
    "/auth/account/password",
    { current_password: currentPassword, new_password: newPassword },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

export async function updateAccount(token, { email }) {
  const response = await client.patch(
    "/auth/account",
    { email },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

export async function getUserTracking(username, status = null) {
  const params = {};
  if (status) params.status = status;
  const response = await client.get(`/auth/users/${encodeURIComponent(username)}/tracking`, {
    params,
  });
  return response.data;
}

export async function getUserFavorites(username) {
  const response = await client.get(`/auth/users/${encodeURIComponent(username)}/favorites`);
  return response.data;
}

export async function deleteAccount(password, token) {
  const response = await client.delete("/auth/account", {
    headers: { Authorization: `Bearer ${token}` },
    data: { password },
  });
  return response.data;
}


