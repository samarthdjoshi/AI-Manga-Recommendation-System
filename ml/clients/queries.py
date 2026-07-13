"""
AniList GraphQL queries.
"""

from __future__ import annotations

# Shared field selection, reused by both the legacy page query and the
# new ID-batch queries so every field stays consistent everywhere.
MEDIA_FIELDS = """
    id
    title {
        romaji
        english
        native
    }
    format
    status
    description(asHtml: false)
    chapters
    volumes
    genres
    averageScore
    popularity
    favourites
    countryOfOrigin
    coverImage {
        extraLarge
        large
        medium
    }
    bannerImage
    startDate {
        year
        month
        day
    }
    endDate {
        year
        month
        day
    }
    tags {
        name
        rank
    }
    studios {
        nodes {
            name
        }
    }
"""

# Legacy page/perPage query. Kept for reference only — AniList caps
# page * perPage at 5000 entries ("Page depth exceeds maximum allowed"),
# and with no explicit `sort`, results default to POPULARITY_DESC,
# SCORE_DESC (not ID order), so this cannot retrieve the full catalog
# and does not produce a resumable, gap-free dataset. Do not use for
# bulk collection — use the ID-batch queries below instead.
MANGA_PAGE_QUERY = """
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      currentPage
      hasNextPage
      perPage
      total
      lastPage
    }
    media(type: MANGA) {
""" + MEDIA_FIELDS + """
    }
  }
}
"""

# Finds the highest AniList ID currently assigned to any manga entry.
# page is always 1 here (single result), so the 5000-entry depth cap
# never applies to this query.
MAX_MANGA_ID_QUERY = """
query {
  Page(page: 1, perPage: 1) {
    media(type: MANGA, sort: ID_DESC) {
      id
    }
  }
}
"""


# Batch lookup using id_in on the LIST field media, not the singular
# Media(id:) field. This matters: AniList's singular Media(id: X)
# returns an HTTP 404 for the whole request if that one ID doesn't
# match a manga (e.g. it's an anime ID, or doesn't exist at all) —
# and in a sequential ID scan, almost every batch hits at least one
# such ID. The list field media(id_in: [...]) simply omits non-matches
# from the results instead of erroring, which is what we actually want.
MEDIA_BATCH_QUERY = """
query ($ids: [Int], $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(id_in: $ids, type: MANGA) {
""" + MEDIA_FIELDS + """
    }
  }
}
"""

