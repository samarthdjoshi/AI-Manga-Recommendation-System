"""
Thin wrapper around the Gemini API for the RAG chatbot, using the
actively-maintained google-genai SDK (google-generativeai was fully
deprecated and is no longer receiving updates/fixes as of this build).

Builds a prompt grounded in retrieved catalog context plus conversation
history, and returns Gemini''s reply as plain text.
"""

from __future__ import annotations

import time

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from common.config import settings


class ChatUnavailableError(RuntimeError):
    """Raised when the Gemini API cannot fulfil a chat request right now,
    either because it is transiently overloaded (after retries) or the
    request itself was rejected for a non-retryable reason (bad key,
    permission denied, etc.). The /chat endpoint catches this and returns
    a clean 503 instead of a raw 500 with a stack trace."""


MODEL_NAME = "gemini-3.5-flash-lite"

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not set in .env")
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


SYSTEM_INSTRUCTION = """You are the recommendation assistant for Mangalyst, a manga/manhwa/manhua \
discovery app. You help users find titles and answer questions about specific manga.

Rules:
- Only recommend or describe titles that appear in the CATALOG CONTEXT provided below. \
Never invent, guess, or recall titles from your own training data - the app''s catalog is \
the only source of truth, and a title you "remember" may not even be searchable in this app.
- If the catalog context doesn''t contain anything relevant to the question, say so honestly \
and suggest the user try a different search rather than making something up.
- Keep responses conversational and concise - a few sentences, not an essay.
- When you recommend a title, briefly say why it fits what the user asked for, using the \
genres/description/rating given in the context.
"""


def generate_reply(
    message: str,
    history: list[dict],
    context_records: list[dict],
    page_context_title: str | None = None,
) -> str:
    client = _get_client()

    context_lines = []
    for r in context_records:
        genres = ", ".join(r.get("genres", [])[:6]) or "unknown genres"
        rating = r.get("rating_combined")
        rating_str = f"{rating:.1f}/10" if rating is not None else "no rating"
        desc = (r.get("description") or "").strip()
        desc = (desc[:220] + "...") if len(desc) > 220 else desc
        reason = r.get("_match_reason")
        tag = " [SIMILAR TO CURRENT PAGE]" if reason == "similar_to_current_page" else ""
        context_lines.append(
            f"- {r.get('title')} ({r.get('year', 'unknown year')}){tag} | {genres} | "
            f"rating {rating_str}\n  {desc}"
        )
    context_block = "\n".join(context_lines) if context_lines else "(no relevant titles found in catalog)"

    contents: list[types.Content] = []
    for turn in history[-10:]:
        role = "model" if turn.get("role") == "assistant" else "user"
        contents.append(
            types.Content(role=role, parts=[types.Part.from_text(text=turn.get("content", ""))])
        )

    page_context_line = (
        f"The user is currently viewing the manga page for \"{page_context_title}\". "
        f"If it is relevant to their question, feel free to reference it or compare other "
        f"titles to it - but only if it actually helps answer what they asked.\n\n"
        if page_context_title else ""
    )
    prompt = f"{page_context_line}CATALOG CONTEXT:\n{context_block}\n\nUSER QUESTION: {message}"
    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=prompt)]))

    max_attempts = 3
    last_error: Exception | None = None

    for attempt in range(1, max_attempts + 1):
        try:
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=contents,
                config=types.GenerateContentConfig(system_instruction=SYSTEM_INSTRUCTION),
            )
            return response.text
        except genai_errors.ServerError as exc:
            # Transient overload (503) or similar - worth a short retry.
            last_error = exc
            if attempt < max_attempts:
                time.sleep(2 * attempt)
                continue
        except genai_errors.ClientError as exc:
            # Bad API key, permission denied, quota exhausted, etc. -
            # retrying won't help, fail immediately with a clean message.
            print(f"GEMINI CLIENT ERROR: {exc}")
            raise ChatUnavailableError(
                "The AI assistant rejected this request (check the Gemini API key/quota)."
            ) from exc

    raise ChatUnavailableError(
        "The AI assistant is temporarily overloaded. Please try again in a moment."
    ) from last_error
