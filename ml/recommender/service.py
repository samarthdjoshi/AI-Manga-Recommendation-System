"""
Shared recommendation service: loads Gold records + FAISS index once,
and exposes title search + similarity lookup. Used by both the
FastAPI layer and scripts/recommend.py, so the core logic lives in
exactly one tested place.
"""

from __future__ import annotations

from collections import defaultdict
import json
import re
from typing import ClassVar

import faiss
import numpy as np

from common.paths import SILVER_DIR

DEFAULT_TOP_K = 10
MAX_TOP_K = 200
MAX_SEARCH_RESULTS = 25

# Genre tags that unambiguously indicate explicit sexual content. This is a
# heuristic proxy, not MangaDex's real per-title content_rating field (that
# field exists in Silver but was dropped during the Gold merge - see TODO
# in the entity-resolution/gold-build step to carry it through properly).
EXPLICIT_GENRES = {
    "hentai", "rape", "sexual violence", "ahegao", "nakadashi", "scat",
    "watersports", "ero guro", "zoophilia", "cervix penetration",
    "deepthroat", "double penetration", "fisting", "irrumatio", "rimjob",
    "scissoring", "sumata", "shimaidon", "netorare", "netorase", "netori",
    "anal sex", "ashikoki", "boobjob", "bondage", "cumflation",
    "cunnilingus", "defloration", "erotic piercings", "facial",
    "fellatio", "fingering", "group sex", "handjob", "public sex",
    "sex toys", "squirting", "oyakodon", "lolicon", "shotacon",
}


class MangaNotFoundError(Exception):
    pass


class RecommenderService:
    def __init__(self) -> None:
        gold_dir = SILVER_DIR.parent / "gold"
        model_dir = SILVER_DIR.parent / "model"

        records: list[dict] = []
        for page_file in sorted(gold_dir.glob("page_*.json")):
            data = json.loads(page_file.read_text(encoding="utf-8"))
            records.extend(data.get("records", []))

        self.records: list[dict] = records
        self.records_by_gold_id: dict[str, dict] = {r["gold_id"]: r for r in records}

        # Pre-sort catalog records once by popularity descending:
        # primary: source_count desc, secondary: rating_combined desc
        self._records_by_popularity: list[dict] = sorted(
            records,
            key=lambda r: (
                r.get("source_count", 0),
                r.get("rating_combined") or 0.0,
            ),
            reverse=True,
        )
        self._prep_titles: list[tuple[str, dict]] = [
            (r["title"].lower(), r) for r in self._records_by_popularity if r.get("title")
        ]

        # Compact prefix & word index for sub-millisecond autocomplete suggestions.
        # Index top 100,000 records (covers all multi-source and popular titles).
        self._prefix_map: dict[str, list[dict]] = defaultdict(list)
        for title_lower, r in self._prep_titles[:100000]:
            seen_prefixes: set[str] = set()
            # 1. Title prefixes (1 to 4 characters)
            for length in range(1, min(5, len(title_lower) + 1)):
                p = title_lower[:length]
                if p not in seen_prefixes:
                    seen_prefixes.add(p)
                    bucket = self._prefix_map[p]
                    if len(bucket) < 40:
                        bucket.append(r)
            # 2. Word prefixes (1 to 3 characters)
            words = title_lower.split()
            for w in words[1:5]:
                for length in range(1, min(4, len(w) + 1)):
                    p = w[:length]
                    if p not in seen_prefixes:
                        seen_prefixes.add(p)
                        bucket = self._prefix_map[p]
                        if len(bucket) < 40:
                            bucket.append(r)

        self._search_cache: dict[tuple[str, int], list[dict]] = {}
        self._search_cache_max: int = 4096

        # O(1) title lookup indices for lightning-fast library imports and resolution
        self._title_to_gold_id: dict[str, str] = {}
        self._clean_title_to_gold_id: dict[str, str] = {}
        for r in reversed(self._records_by_popularity):
            gid = r.get("gold_id")
            if not gid:
                continue
            title = r.get("title")
            if title:
                tl = title.strip().lower()
                self._title_to_gold_id[tl] = gid
                cl = re.sub(r"[^a-zA-Z0-9\s]", "", title).lower().strip()
                if cl:
                    self._clean_title_to_gold_id[cl] = gid
            ot = r.get("original_title")
            if ot:
                otl = ot.strip().lower()
                if otl not in self._title_to_gold_id:
                    self._title_to_gold_id[otl] = gid
                ocl = re.sub(r"[^a-zA-Z0-9\s]", "", ot).lower().strip()
                if ocl and ocl not in self._clean_title_to_gold_id:
                    self._clean_title_to_gold_id[ocl] = gid

        self.index = faiss.read_index(str(model_dir / "similarity_index.faiss"))
        with (model_dir / "index_gold_ids.json").open("r", encoding="utf-8") as f:
            self.index_gold_ids: list[str] = json.load(f)

        self.gold_id_to_row: dict[str, int] = {gid: i for i, gid in enumerate(self.index_gold_ids)}

    def resolve_title_to_gold_id(self, title: str) -> str | None:
        """Resolve a manga title or clean title variant to a canonical gold_id in O(1)."""
        if not title:
            return None
        tl = title.strip().lower()
        if tl in self._title_to_gold_id:
            return self._title_to_gold_id[tl]
        cl = re.sub(r"[^a-zA-Z0-9\s]", "", title).lower().strip()
        if cl in self._clean_title_to_gold_id:
            return self._clean_title_to_gold_id[cl]
        return None

    @property
    def total_records(self) -> int:
        return len(self.records)

    @property
    def indexed_records(self) -> int:
        return len(self.index_gold_ids)

    def search(self, query: str, limit: int = MAX_SEARCH_RESULTS) -> list[dict]:
        query_clean = (query or "").strip().lower()
        if not query_clean:
            return []

        limit = max(1, min(limit, MAX_SEARCH_RESULTS))
        cache_key = (query_clean, limit)
        if cache_key in self._search_cache:
            return self._search_cache[cache_key]

        # 1. Candidate selection: look up prefix index
        candidates = (
            self._prefix_map.get(query_clean[:4])
            or self._prefix_map.get(query_clean[:3])
            or self._prefix_map.get(query_clean[:2])
            or self._prefix_map.get(query_clean[:1])
        )

        tier1_prefix: list[dict] = []
        tier2_word: list[dict] = []
        tier3_sub: list[dict] = []
        seen_ids: set[str] = set()

        word_prefix_sep = " " + query_clean
        dash_prefix_sep = "-" + query_clean
        paren_prefix_sep = "(" + query_clean

        if candidates:
            for r in candidates:
                gid = r.get("gold_id", "")
                t_low = r.get("title", "").lower()
                if t_low.startswith(query_clean):
                    tier1_prefix.append(r)
                    seen_ids.add(gid)
                    if len(tier1_prefix) >= limit:
                        results = tier1_prefix[:limit]
                        if len(self._search_cache) >= self._search_cache_max:
                            self._search_cache.pop(next(iter(self._search_cache)))
                        self._search_cache[cache_key] = results
                        return results
                elif (
                    word_prefix_sep in t_low
                    or dash_prefix_sep in t_low
                    or paren_prefix_sep in t_low
                ):
                    tier2_word.append(r)
                    seen_ids.add(gid)
                elif query_clean in t_low:
                    tier3_sub.append(r)
                    seen_ids.add(gid)

        collected = tier1_prefix + tier2_word + tier3_sub
        if len(collected) >= limit:
            results = collected[:limit]
            if len(self._search_cache) >= self._search_cache_max:
                self._search_cache.pop(next(iter(self._search_cache)))
            self._search_cache[cache_key] = results
            return results

        # 2. If candidates did not satisfy limit (e.g. interior substrings or less common titles),
        # scan self._prep_titles (already ordered by popularity descending)
        for title_lower, r in self._prep_titles:
            gid = r.get("gold_id", "")
            if gid in seen_ids:
                continue
            if title_lower.startswith(query_clean):
                tier1_prefix.append(r)
                seen_ids.add(gid)
                if len(tier1_prefix) >= limit:
                    break
            elif (
                word_prefix_sep in title_lower
                or dash_prefix_sep in title_lower
                or paren_prefix_sep in title_lower
            ):
                tier2_word.append(r)
                seen_ids.add(gid)
                if len(tier1_prefix) + len(tier2_word) >= limit:
                    break
            elif query_clean in title_lower:
                tier3_sub.append(r)
                seen_ids.add(gid)
                if len(tier1_prefix) + len(tier2_word) + len(tier3_sub) >= limit * 2:
                    break

        results = (tier1_prefix + tier2_word + tier3_sub)[:limit]
        if len(self._search_cache) >= self._search_cache_max:
            self._search_cache.pop(next(iter(self._search_cache)))
        self._search_cache[cache_key] = results
        return results

    # Titles that are also common, generic conversational words. A whole-word
    # substring match against one of these says almost nothing about actual
    # user intent (e.g. "something like Solo Leveling" is not about the manga
    # called "Something"), so they''re excluded from mention-detection even
    # though they are real catalog titles.
    _GENERIC_WORD_TITLES: ClassVar[set[str]] = {
        "something", "anything", "everything", "nothing", "someone",
        "everyone", "somewhere", "anywhere", "level", "world", "life",
        "time", "day", "legend", "hero", "love", "family", "king",
        "queen", "raid", "great", "the great",
    }

    def find_titles_mentioned_in_text(self, text: str, limit: int = 5) -> list[dict]:
        """
        Reverse of search(): finds real catalog titles that appear AS A
        SUBSTRING WITHIN the given text, rather than checking whether the
        text is a substring of the title. This is what a chat message
        needs - "something like solo leveling with more chapters" should
        find the "Solo Leveling" record, which plain search() (built for
        title-box typeahead) cannot do, since the whole sentence is never
        a substring of any title.

        Titles under 4 characters are skipped to avoid trivial/noisy
        matches (e.g. a title called "It" matching almost any sentence).
        Longer, more specific title matches are preferred when multiple
        titles are mentioned.
        """
        text_lower = (text or "").lower()
        if not text_lower:
            return []

        matches = []
        for r in self.records:
            title = r.get("title")
            if not title or len(title) < 4:
                continue
            title_lower = title.lower()
            if title_lower in self._GENERIC_WORD_TITLES:
                continue
            # Word-boundary match, not raw substring: a short title like
            # "Great" or "Raid" must appear as a whole word/phrase in the
            # message, never as a fragment buried inside a longer word
            # (e.g. "Great" inside "Greatest", "Raid" inside "Raider").
            pattern = r"\b" + re.escape(title_lower) + r"\b"
            if re.search(pattern, text_lower):
                matches.append(r)

        matches.sort(key=lambda r: (len(r.get("title", "")), r.get("source_count", 0)), reverse=True)
        return matches[:limit]

    def get_by_id(self, gold_id: str) -> dict:
        record = self.records_by_gold_id.get(gold_id)
        if record is None:
            raise MangaNotFoundError(f"No manga found with gold_id={gold_id!r}")
        return record

    def recommend(self, gold_id: str, top_k: int = DEFAULT_TOP_K) -> list[dict]:
        if gold_id not in self.records_by_gold_id:
            raise MangaNotFoundError(f"No manga found with gold_id={gold_id!r}")

        if gold_id not in self.gold_id_to_row:
            raise MangaNotFoundError(f"gold_id={gold_id!r} exists but is not in the similarity index")

        top_k = max(1, min(top_k, MAX_TOP_K))

        row = self.gold_id_to_row[gold_id]
        query_vector = self.index.reconstruct(row).reshape(1, -1)
        scores, row_indices = self.index.search(query_vector, top_k + 1)

        results = []
        for score, row_idx in zip(scores[0], row_indices[0]):
            candidate_gold_id = self.index_gold_ids[row_idx]
            if candidate_gold_id == gold_id:
                continue
            record = self.records_by_gold_id.get(candidate_gold_id)
            if record is None:
                continue
            results.append({**record, "similarity_score": float(score)})
            if len(results) >= top_k:
                break

        return results

    def discover(self, sort: str = "rating", limit: int = 12) -> list[dict]:
        """
        Returns a curated list of records for homepage discovery rails.

        sort="rating": ranked by rating_combined, weighted by total vote
        confidence (AniList favourites + MangaUpdates rating votes) as a
        popularity proxy - NOT a time-based "trending" signal, since we
        have no live update/activity data to base that on honestly.

        sort="corroborated": records confirmed across all 3 sources
        (source_count == 3), ranked by rating. This is a signal unique
        to this project's multi-source entity resolution work.
        """

        limit = max(1, min(limit, 25))

        if sort == "corroborated":
            candidates = [r for r in self.records if r.get("source_count") == 3]
        else:
            candidates = [r for r in self.records if r.get("rating_combined") is not None]

        def sort_key(record: dict) -> tuple[float, float]:
            rating = record.get("rating_combined") or 0
            confidence = (
                (record.get("rating_anilist_confidence") or 0)
                + (record.get("rating_mangaupdates_confidence") or 0)
            )
            return (rating, confidence)

        candidates.sort(key=sort_key, reverse=True)
        return candidates[:limit]

    def browse(
        self,
        q: str | None = None,
        genres: list[str] | None = None,
        exclude_genres: list[str] | None = None,
        genre_match: str = "and",
        hide_explicit: bool = True,
        hide_doujinshi: bool = True,
        status: str | None = None,
        year_min: int | None = None,
        year_max: int | None = None,
        min_chapters: int | None = None,
        max_chapters: int | None = None,
        min_rating: float | None = None,
        min_sources: int | None = None,
        has_official_links: bool | None = None,
        sort: str = "rating",
        limit: int = 24,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """
        Filters and sorts the full gold catalog for the Browse page.

        Deliberately only filters on fields we actually have real data
        for: query, genres, publication status, year, chapters, ratings,
        sources, official links, and content preferences.
        """
        records = self.records

        filtered = records

        if q and q.strip():
            q_clean = q.strip().lower()
            filtered = [
                r for r in filtered
                if r.get("title") and q_clean in r["title"].lower()
            ]

        if genres:
            wanted = {g.strip().lower() for g in genres if g.strip()}
            if wanted:
                if genre_match == "or":
                    filtered = [
                        r for r in filtered
                        if wanted & {g.lower() for g in (r.get("genres") or [])}
                    ]
                else:
                    filtered = [
                        r for r in filtered
                        if wanted.issubset({g.lower() for g in (r.get("genres") or [])})
                    ]

        if exclude_genres:
            unwanted = {g.strip().lower() for g in exclude_genres if g.strip()}
            if unwanted:
                filtered = [
                    r for r in filtered
                    if not (unwanted & {g.lower() for g in (r.get("genres") or [])})
                ]

        if status:
            status_lower = status.strip().lower()
            status_map = {
                "completed": {"completed", "finished"},
                "releasing": {"releasing", "ongoing"},
                "hiatus": {"hiatus"},
                "cancelled": {"cancelled"},
            }
            target_statuses = status_map.get(status_lower, {status_lower})
            filtered = [
                r for r in filtered
                if (r.get("status_raw") or "").lower() in target_statuses
            ]

        if year_min is not None:
            filtered = [r for r in filtered if r.get("year") and r["year"] >= year_min]

        if year_max is not None:
            filtered = [r for r in filtered if r.get("year") and r["year"] <= year_max]

        if min_chapters is not None:
            filtered = [r for r in filtered if (r.get("chapters") or 0) >= min_chapters]

        if max_chapters is not None:
            filtered = [r for r in filtered if r.get("chapters") is not None and r["chapters"] <= max_chapters]

        if min_rating is not None:
            filtered = [r for r in filtered if (r.get("rating_combined") or 0.0) >= min_rating]

        if min_sources is not None:
            filtered = [r for r in filtered if (r.get("source_count") or 0) >= min_sources]

        if has_official_links is not None:
            if has_official_links:
                filtered = [
                    r for r in filtered
                    if r.get("official_links") and (
                        (r["official_links"].get("read") and len(r["official_links"]["read"]) > 0)
                        or (r["official_links"].get("info") and len(r["official_links"]["info"]) > 0)
                    )
                ]
            else:
                filtered = [
                    r for r in filtered
                    if not (
                        r.get("official_links") and (
                            (r["official_links"].get("read") and len(r["official_links"]["read"]) > 0)
                            or (r["official_links"].get("info") and len(r["official_links"]["info"]) > 0)
                        )
                    )
                ]

        if hide_explicit:
            filtered = [
                r for r in filtered
                if not (EXPLICIT_GENRES & {g.lower() for g in (r.get("genres") or [])})
            ]

        if hide_doujinshi:
            filtered = [
                r for r in filtered
                if "doujinshi" not in {g.lower() for g in (r.get("genres") or [])}
            ]

        if sort in ("corroborated", "most_viewed_all"):
            filtered = sorted(
                filtered,
                key=lambda r: (r.get("source_count", 0), r.get("chapters") or 0, r.get("rating_combined") or 0.0),
                reverse=True,
            )
        elif sort in ("newest", "year_newest"):
            filtered = sorted(
                filtered,
                key=lambda r: (r.get("year") or 0, r.get("rating_combined") or 0.0),
                reverse=True,
            )
        elif sort == "year_oldest":
            filtered = sorted(
                filtered,
                key=lambda r: (r.get("year") or 9999, -(r.get("rating_combined") or 0.0)),
            )
        elif sort in ("title", "title_asc"):
            filtered = sorted(filtered, key=lambda r: (r.get("title") or "").strip().lower())
        elif sort == "title_desc":
            filtered = sorted(filtered, key=lambda r: (r.get("title") or "").strip().lower(), reverse=True)
        elif sort == "latest_update":
            filtered = sorted(
                filtered,
                key=lambda r: (
                    1 if (r.get("status_raw") or "").lower() in ("releasing", "ongoing") else 0,
                    r.get("year") or 0,
                    r.get("chapters") or 0,
                    r.get("rating_combined") or 0.0,
                ),
                reverse=True,
            )
        elif sort == "recently_added":
            filtered = sorted(
                filtered,
                key=lambda r: (
                    r.get("year") or 0,
                    r.get("gold_id") or "",
                ),
                reverse=True,
            )
        elif sort == "most_viewed_7d":
            filtered = sorted(
                filtered,
                key=lambda r: (
                    1 if (r.get("status_raw") or "").lower() in ("releasing", "ongoing") else 0,
                    r.get("source_count", 0),
                    r.get("rating_combined") or 0.0,
                ),
                reverse=True,
            )
        elif sort == "most_viewed_30d":
            filtered = sorted(
                filtered,
                key=lambda r: (
                    1 if (r.get("source_count", 0) >= 2) else 0,
                    r.get("rating_combined") or 0.0,
                    r.get("chapters") or 0,
                ),
                reverse=True,
            )
        elif sort == "most_viewed_90d":
            filtered = sorted(
                filtered,
                key=lambda r: (
                    r.get("source_count", 0),
                    r.get("rating_combined") or 0.0,
                    r.get("chapters") or 0,
                ),
                reverse=True,
            )
        elif sort == "most_followed":
            filtered = sorted(
                filtered,
                key=lambda r: (
                    r.get("source_count", 0),
                    r.get("rating_anilist") or 0.0,
                    r.get("rating_combined") or 0.0,
                ),
                reverse=True,
            )
        elif sort == "best_match":
            if q and q.strip():
                q_clean = q.strip().lower()

                def _match_score(r: dict) -> tuple:
                    t = (r.get("title") or "").strip().lower()
                    if t == q_clean:
                        tier = 3
                    elif t.startswith(q_clean):
                        tier = 2
                    elif q_clean in t:
                        tier = 1
                    else:
                        tier = 0
                    return (tier, r.get("rating_combined") or 0.0, r.get("source_count", 0))

                filtered = sorted(filtered, key=_match_score, reverse=True)
            else:
                filtered = sorted(
                    filtered,
                    key=lambda r: (r.get("rating_combined") or 0.0, r.get("source_count", 0)),
                    reverse=True,
                )
        else:  # "highest_rated" or legacy "rating"
            filtered = sorted(
                filtered,
                key=lambda r: (r.get("rating_combined") or 0.0, r.get("source_count", 0)),
                reverse=True,
            )

        total = len(filtered)
        page = filtered[offset : offset + limit]
        return page, total

    def list_genres(self) -> list[str]:
        """All distinct genres in the gold catalog, for the filter UI."""
        seen: set[str] = set()
        for r in self.records:
            seen.update(r.get("genres", []))
        return sorted(seen)

    def recommend_hybrid(
        self,
        favorite_gold_ids: list[str],
        all_users_favorites: dict[int, list[str]],
        top_k: int = DEFAULT_TOP_K,
        alpha: float = 0.6,
    ) -> list[dict]:
        """
        Personalized hybrid recommendations for a user, combining:

        - Content score C(u,i): cosine similarity between candidate i and
          the user's "taste vector" - the mean of the FAISS vectors of
          every title the user has favorited.
        - Collaborative score H(u,i): normalized count of how often i is
          favorited by *other* users who share at least one favorite
          with this user (a simple item-based collaborative signal).

        S(u,i) = alpha * C(u,i) + (1 - alpha) * H(u,i)

        favorite_gold_ids: this user's favorited gold_ids.
        all_users_favorites: {user_id: [gold_id, ...]} for every user,
          used to compute the collaborative signal. Passed in rather
          than queried here so this service stays free of any direct
          DB dependency - the caller (API layer) owns that.
        """
        top_k = max(1, min(top_k, MAX_TOP_K))

        valid_favorite_ids = [
            gid for gid in favorite_gold_ids if gid in self.gold_id_to_row
        ]
        if not valid_favorite_ids:
            return []

        # --- Content score: mean taste vector, searched against the index ---
        vectors = np.vstack([
            self.index.reconstruct(self.gold_id_to_row[gid])
            for gid in valid_favorite_ids
        ])
        taste_vector = vectors.mean(axis=0, keepdims=True)
        # normalize so it stays comparable to normalized item vectors (cosine via inner product)
        norm = np.linalg.norm(taste_vector)
        if norm > 0:
            taste_vector = taste_vector / norm

        search_k = min(top_k * 5 + len(valid_favorite_ids), self.indexed_records)
        scores, row_indices = self.index.search(taste_vector, search_k)

        favorite_set = set(valid_favorite_ids)
        content_scores: dict[str, float] = {}
        for score, row_idx in zip(scores[0], row_indices[0]):
            if row_idx < 0:
                continue
            candidate_id = self.index_gold_ids[row_idx]
            if candidate_id in favorite_set:
                continue
            content_scores[candidate_id] = float(score)

        # --- Collaborative score: co-favorite counts among users who overlap with this user ---
        collab_counts: dict[str, int] = {}
        for other_favorites in all_users_favorites.values():
            other_set = set(other_favorites)
            if not (other_set & favorite_set):
                continue  # no overlap with this user - not a useful signal
            for gid in other_set - favorite_set:
                collab_counts[gid] = collab_counts.get(gid, 0) + 1

        max_collab = max(collab_counts.values()) if collab_counts else 0

        # --- Combine ---
        candidate_ids = set(content_scores) | set(collab_counts)
        results = []
        for gid in candidate_ids:
            record = self.records_by_gold_id.get(gid)
            if record is None:
                continue
            c_score = content_scores.get(gid, 0.0)
            h_score = (collab_counts.get(gid, 0) / max_collab) if max_collab > 0 else 0.0
            combined = alpha * c_score + (1 - alpha) * h_score
            results.append({
                **record,
                "similarity_score": combined,
                "content_score": c_score,
                "collaborative_score": h_score,
            })

        results.sort(key=lambda r: r["similarity_score"], reverse=True)
        return results[:top_k]




