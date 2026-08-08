import axios from "axios";

const API_BASE_URL = "http://127.0.0.1:8000";

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export async function checkHealth() {
  const response = await client.get("/health");
  return response.data;
}

export async function searchManga(query, limit = 12) {
  if (!query || !query.trim()) return { query: "", count: 0, results: [] };
  const response = await client.get("/search", {
    params: { q: query, limit },
  });
  return response.data;
}

export async function getManga(goldId) {
  const response = await client.get(`/manga/${encodeURIComponent(goldId)}`);
  return response.data;
}

export async function getRecommendations(goldId, topK = 10) {
  const response = await client.get(`/recommend/${encodeURIComponent(goldId)}`, {
    params: { top_k: topK },
  });
  return response.data;
}

export async function getDiscover(sort = "rating", limit = 12) {
  const response = await client.get("/discover", {
    params: { sort, limit },
  });
  return response.data;
}

export async function getSuggestions(query, limit = 6) {
  if (!query || !query.trim()) return { query: "", results: [] };
  const response = await client.get("/search/suggest", {
    params: { q: query, limit },
  });
  return response.data;
}

export async function browseManga({
  genres = [],
  yearMin,
  yearMax,
  minChapters,
  genreMatch = "and",
  hideExplicit = true,
  sort = "rating",
  limit = 24,
  offset = 0,
} = {}) {
  const params = new URLSearchParams();
  genres.forEach((g) => params.append("genre", g));
  if (yearMin != null) params.append("year_min", yearMin);
  if (yearMax != null) params.append("year_max", yearMax);
  if (minChapters != null) params.append("min_chapters", minChapters);
  if (genreMatch !== "and") params.append("genre_match", genreMatch);
  if (!hideExplicit) params.append("hide_explicit", "false");
  params.append("sort", sort);
  params.append("limit", limit);
  params.append("offset", offset);

  const response = await client.get("/browse", { params });
  return response.data;
}

export async function getGenres() {
  const response = await client.get("/genres");
  return response.data;
}


