"""
Authentication endpoints: register, login, and get-current-user.
"""

from __future__ import annotations

import csv
import html
import io
import json
import re
import time
import uuid
import xml.etree.ElementTree as ET
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from auth.database import (
    Activity,
    ActivityLike,
    ActivityReply,
    CustomList,
    CustomListEntry,
    Favorite,
    Notification,
    PrivateTag,
    TrackingEntry,
    User,
    UserFollow,
    get_db,
)
from auth.schemas import (
    AccountUpdateRequest,
    ActivityCreateRequest,
    ActivityLikeResponse,
    ActivityListResponse,
    ActivityReplyCreateRequest,
    ActivityReplyResponse,
    ActivityResponse,
    BulkUpdateRequest,
    BulkUpdateResponse,
    ChangePasswordRequest,
    ChapterIncrementResponse,
    CustomListCreateRequest,
    CustomListDetailResponse,
    CustomListResponse,
    CustomListsListResponse,
    CustomListUpdateRequest,
    FavoriteListResponse,
    FavoriteResponse,
    FollowToggleResponse,
    ImportCommitRequest,
    ImportCommitResponse,
    ImportPreviewResponse,
    LoginRequest,
    NotificationListResponse,
    NotificationResponse,
    PrivateTagResponse,
    PrivateTagSetRequest,
    PublicUserProfileResponse,
    RegisterRequest,
    TokenResponse,
    TrackingListResponse,
    TrackingResponse,
    TrackingStatus,
    TrackingUpsertRequest,
    UserFollowItem,
    UserFollowListResponse,
    UserProfileResponse,
    UserProfileUpdateRequest,
    UserResponse,
    UserTagsResponse,
)
from auth.security import (
    InvalidTokenError,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

bearer_scheme = HTTPBearer(auto_error=False)
_catalog_id_validator: Callable[[str], bool] | None = None
_catalog_title_resolver: Callable[[str], str | None] | None = None
_catalog_title_getter: Callable[[str], str] | None = None
_catalog_external_resolver: Callable[[str, str], str | None] | None = None


def configure_catalog_id_validator(validator: Callable[[str], bool]) -> None:
    """Configure the API-owned catalog check used before a favorite or entry is stored."""
    global _catalog_id_validator
    _catalog_id_validator = validator


def configure_catalog_title_resolver(resolver: Callable[[str], str | None]) -> None:
    """Configure the catalog check used to resolve titles on import."""
    global _catalog_title_resolver
    _catalog_title_resolver = resolver


def configure_catalog_title_getter(getter: Callable[[str], str]) -> None:
    """Configure the catalog title lookup used for CSV exports."""
    global _catalog_title_getter
    _catalog_title_getter = getter


def configure_catalog_external_resolver(resolver: Callable[[str, str], str | None]) -> None:
    """Configure the external source ID resolver (AniList, MAL, MangaUpdates)."""
    global _catalog_external_resolver
    _catalog_external_resolver = resolver


def _safe_validate_catalog_id(gold_id: str, title: str | None = None, allow_create: bool = False) -> bool:
    """Validate a gold_id in the catalog, only creating if allow_create is True."""
    if _catalog_id_validator is None:
        return False
    try:
        return _catalog_id_validator(gold_id, title, allow_create)  # type: ignore[call-arg]
    except TypeError:
        try:
            return _catalog_id_validator(gold_id, title)  # type: ignore[call-arg]
        except TypeError:
            return _catalog_id_validator(gold_id)


def _require_catalog_id(gold_id: str) -> None:
    if _catalog_id_validator is None:
        raise HTTPException(status_code=503, detail="Catalog service is still starting up")
    if not _safe_validate_catalog_id(gold_id, allow_create=False):
        raise HTTPException(status_code=404, detail="Manga not found")


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    existing_email = db.query(User).filter(User.email == payload.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_username = db.query(User).filter(User.username == payload.username).first()
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user_id=user.id, username=user.username)

    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user.id, email=user.email, username=user.username),
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.email == payload.email).first()

    # Intentionally identical error for "no such user" and "wrong password" -
    # revealing which one it was lets an attacker enumerate valid emails.
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user_id=user.id, username=user.username)

    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user.id, email=user.email, username=user.username),
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency for protected routes. Use as:
        current_user: User = Depends(get_current_user)
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = decode_access_token(credentials.credentials)
    except InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Token is invalid") from exc
    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise HTTPException(status_code=401, detail="User no longer exists")

    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    if credentials is None:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload["sub"])
        return db.query(User).filter(User.id == user_id).first()
    except Exception:
        return None



@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(id=current_user.id, email=current_user.email, username=current_user.username)


@router.post("/favorites/{gold_id}", response_model=FavoriteResponse, status_code=status.HTTP_201_CREATED)
def add_favorite(
    gold_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FavoriteResponse:
    _require_catalog_id(gold_id)
    existing = (
        db.query(Favorite)
        .filter(Favorite.user_id == current_user.id, Favorite.gold_id == gold_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already favorited")
    favorite = Favorite(user_id=current_user.id, gold_id=gold_id)
    db.add(favorite)
    db.commit()
    db.refresh(favorite)
    return FavoriteResponse(gold_id=favorite.gold_id, created_at=favorite.created_at.isoformat())


@router.delete("/favorites/{gold_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(
    gold_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    favorite = (
        db.query(Favorite)
        .filter(Favorite.user_id == current_user.id, Favorite.gold_id == gold_id)
        .first()
    )
    if favorite is None:
        raise HTTPException(status_code=404, detail="Not favorited")
    db.delete(favorite)
    db.commit()


@router.get("/favorites", response_model=FavoriteListResponse)
def list_favorites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FavoriteListResponse:
    favorites = (
        db.query(Favorite)
        .filter(Favorite.user_id == current_user.id)
        .order_by(Favorite.created_at.desc())
        .all()
    )
    return FavoriteListResponse(
        count=len(favorites),
        favorites=[
            FavoriteResponse(gold_id=f.gold_id, created_at=f.created_at.isoformat())
            for f in favorites
        ],
    )


def _tracking_response(entry: TrackingEntry) -> TrackingResponse:
    return TrackingResponse(
        gold_id=entry.gold_id,
        status=entry.status,
        progress=entry.progress,
        score=entry.score,
        notes=entry.notes,
        updated_at=entry.updated_at.isoformat(),
    )


@router.put("/tracking/{gold_id}", response_model=TrackingResponse)
def upsert_tracking(
    gold_id: str,
    payload: TrackingUpsertRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TrackingResponse:
    _require_catalog_id(gold_id)
    entry = db.query(TrackingEntry).filter(
        TrackingEntry.user_id == current_user.id,
        TrackingEntry.gold_id == gold_id,
    ).first()
    if entry is None:
        entry = TrackingEntry(user_id=current_user.id, gold_id=gold_id)
        db.add(entry)
    entry.status = payload.status
    entry.progress = payload.progress
    entry.score = payload.score
    entry.notes = payload.notes.strip() if payload.notes else None
    db.commit()
    db.refresh(entry)
    return _tracking_response(entry)


@router.get("/tracking", response_model=TrackingListResponse)
def list_tracking(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TrackingListResponse:
    entries = db.query(TrackingEntry).filter(
        TrackingEntry.user_id == current_user.id
    ).order_by(TrackingEntry.updated_at.desc()).all()
    return TrackingListResponse(count=len(entries), entries=[_tracking_response(entry) for entry in entries])


@router.delete("/tracking/{gold_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_tracking(
    gold_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    entry = db.query(TrackingEntry).filter(
        TrackingEntry.user_id == current_user.id,
        TrackingEntry.gold_id == gold_id,
    ).first()
    if entry is None:
        raise HTTPException(status_code=404, detail="Tracking entry not found")
    db.delete(entry)
    db.commit()


# --- Security & Serialization Helpers ---


def _sanitize_csv_cell(val: str | None) -> str:
    """Sanitize CSV cells against spreadsheet formula injection."""
    if val is None:
        return ""
    s = str(val).replace("\r\n", " ").replace("\n", " ").replace("\r", " ")
    if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{s}"
    return s


def _desanitize_csv_cell(val: str) -> str:
    """Strip leading injection defense quote upon import."""
    if val and len(val) >= 2 and val[0] == "'" and val[1] in ("=", "+", "-", "@", "\t", "\r"):
        return val[1:]
    return val


_PREVIEW_STORE: dict[str, dict] = {}
_PREVIEW_TTL_SECONDS = 900  # 15 minutes


def _clean_preview_store() -> None:
    now = time.time()
    expired = [
        tok for tok, entry in _PREVIEW_STORE.items()
        if now - entry["created_at"] > _PREVIEW_TTL_SECONDS
    ]
    for tok in expired:
        _PREVIEW_STORE.pop(tok, None)


# --- Custom Lists Endpoints ---


@router.post("/lists", response_model=CustomListResponse, status_code=status.HTTP_201_CREATED)
def create_custom_list(
    payload: CustomListCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CustomListResponse:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="List name cannot be empty")
    existing = db.query(CustomList).filter(
        CustomList.user_id == current_user.id,
        CustomList.name == name,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A list with this name already exists")
    custom_list = CustomList(
        user_id=current_user.id,
        name=name,
        description=payload.description.strip() if payload.description else None,
    )
    db.add(custom_list)
    db.commit()
    db.refresh(custom_list)
    return CustomListResponse(
        id=custom_list.id,
        name=custom_list.name,
        description=custom_list.description,
        entry_count=0,
        created_at=custom_list.created_at.isoformat(),
        updated_at=custom_list.updated_at.isoformat(),
    )


@router.get("/lists", response_model=CustomListsListResponse)
def list_custom_lists(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CustomListsListResponse:
    lists = db.query(CustomList).filter(
        CustomList.user_id == current_user.id
    ).order_by(CustomList.created_at.asc()).all()
    res = [
        CustomListResponse(
            id=lst.id,
            name=lst.name,
            description=lst.description,
            entry_count=len(lst.entries),
            created_at=lst.created_at.isoformat(),
            updated_at=lst.updated_at.isoformat(),
        )
        for lst in lists
    ]
    return CustomListsListResponse(count=len(res), lists=res)


@router.get("/lists/{list_id}", response_model=CustomListDetailResponse)
def get_custom_list(
    list_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CustomListDetailResponse:
    lst = db.query(CustomList).filter(
        CustomList.id == list_id,
        CustomList.user_id == current_user.id,
    ).first()
    if lst is None:
        raise HTTPException(status_code=404, detail="Custom list not found")
    return CustomListDetailResponse(
        id=lst.id,
        name=lst.name,
        description=lst.description,
        entries=[e.gold_id for e in lst.entries],
        created_at=lst.created_at.isoformat(),
        updated_at=lst.updated_at.isoformat(),
    )


@router.patch("/lists/{list_id}", response_model=CustomListResponse)
def update_custom_list(
    list_id: int,
    payload: CustomListUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CustomListResponse:
    lst = db.query(CustomList).filter(
        CustomList.id == list_id,
        CustomList.user_id == current_user.id,
    ).first()
    if lst is None:
        raise HTTPException(status_code=404, detail="Custom list not found")
    if payload.name is not None:
        new_name = payload.name.strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="List name cannot be empty")
        if new_name != lst.name:
            dup = db.query(CustomList).filter(
                CustomList.user_id == current_user.id,
                CustomList.name == new_name,
            ).first()
            if dup:
                raise HTTPException(status_code=400, detail="A list with this name already exists")
            lst.name = new_name
    if payload.description is not None:
        lst.description = payload.description.strip() if payload.description else None
    db.commit()
    db.refresh(lst)
    return CustomListResponse(
        id=lst.id,
        name=lst.name,
        description=lst.description,
        entry_count=len(lst.entries),
        created_at=lst.created_at.isoformat(),
        updated_at=lst.updated_at.isoformat(),
    )


@router.delete("/lists/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_custom_list(
    list_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    lst = db.query(CustomList).filter(
        CustomList.id == list_id,
        CustomList.user_id == current_user.id,
    ).first()
    if lst is None:
        raise HTTPException(status_code=404, detail="Custom list not found")
    db.delete(lst)
    db.commit()


@router.post("/lists/{list_id}/entries/{gold_id}", status_code=status.HTTP_204_NO_CONTENT)
def add_entry_to_custom_list(
    list_id: int,
    gold_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    lst = db.query(CustomList).filter(
        CustomList.id == list_id,
        CustomList.user_id == current_user.id,
    ).first()
    if lst is None:
        raise HTTPException(status_code=404, detail="Custom list not found")
    _require_catalog_id(gold_id)
    entry = db.query(CustomListEntry).filter(
        CustomListEntry.list_id == list_id,
        CustomListEntry.gold_id == gold_id,
    ).first()
    if not entry:
        entry = CustomListEntry(list_id=list_id, user_id=current_user.id, gold_id=gold_id)
        db.add(entry)
        db.commit()


@router.delete("/lists/{list_id}/entries/{gold_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_entry_from_custom_list(
    list_id: int,
    gold_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    lst = db.query(CustomList).filter(
        CustomList.id == list_id,
        CustomList.user_id == current_user.id,
    ).first()
    if lst is None:
        raise HTTPException(status_code=404, detail="Custom list not found")
    entry = db.query(CustomListEntry).filter(
        CustomListEntry.list_id == list_id,
        CustomListEntry.user_id == current_user.id,
        CustomListEntry.gold_id == gold_id,
    ).first()
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not in this list")
    db.delete(entry)
    db.commit()


# --- Private Tags Endpoints ---


@router.get("/tags", response_model=UserTagsResponse)
def get_all_user_tags(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserTagsResponse:
    tags = db.query(PrivateTag).filter(PrivateTag.user_id == current_user.id).all()
    grouped: dict[str, list[str]] = {}
    for t in tags:
        grouped.setdefault(t.gold_id, []).append(t.tag)
    for gid in grouped:
        grouped[gid].sort()
    return UserTagsResponse(tags_by_gold_id=grouped)


@router.get("/tags/{gold_id}", response_model=PrivateTagResponse)
def get_tags_for_gold_id(
    gold_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PrivateTagResponse:
    _require_catalog_id(gold_id)
    tags = (
        db.query(PrivateTag)
        .filter(PrivateTag.user_id == current_user.id, PrivateTag.gold_id == gold_id)
        .order_by(PrivateTag.tag.asc())
        .all()
    )
    return PrivateTagResponse(gold_id=gold_id, tags=[t.tag for t in tags])


@router.put("/tags/{gold_id}", response_model=PrivateTagResponse)
def set_tags_for_gold_id(
    gold_id: str,
    payload: PrivateTagSetRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PrivateTagResponse:
    _require_catalog_id(gold_id)
    norm_tags = sorted({t.strip().lower()[:50] for t in payload.tags if t.strip()})
    db.query(PrivateTag).filter(
        PrivateTag.user_id == current_user.id,
        PrivateTag.gold_id == gold_id,
    ).delete(synchronize_session=False)
    for t in norm_tags:
        db.add(PrivateTag(user_id=current_user.id, gold_id=gold_id, tag=t))
    db.commit()
    return PrivateTagResponse(gold_id=gold_id, tags=norm_tags)


@router.delete("/tags/{gold_id}/{tag}", status_code=status.HTTP_204_NO_CONTENT)
def delete_single_tag(
    gold_id: str,
    tag: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    _require_catalog_id(gold_id)
    norm_tag = tag.strip().lower()
    entry = db.query(PrivateTag).filter(
        PrivateTag.user_id == current_user.id,
        PrivateTag.gold_id == gold_id,
        PrivateTag.tag == norm_tag,
    ).first()
    if entry is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(entry)
    db.commit()


# --- Bulk Edit Endpoints ---


@router.post("/library/bulk", response_model=BulkUpdateResponse)
def bulk_update_library(
    payload: BulkUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BulkUpdateResponse:
    if not payload.gold_ids:
        raise HTTPException(status_code=400, detail="No gold_ids provided")
    if len(payload.gold_ids) > 200:
        raise HTTPException(status_code=400, detail="Cannot bulk-update more than 200 titles at once")

    for gid in payload.gold_ids:
        _require_catalog_id(gid)

    all_list_ids = set(payload.add_to_list_ids + payload.remove_from_list_ids)
    if all_list_ids:
        owned_lists = db.query(CustomList.id).filter(
            CustomList.user_id == current_user.id,
            CustomList.id.in_(all_list_ids),
        ).all()
        owned_set = {lst_id for (lst_id,) in owned_lists}
        unowned = all_list_ids - owned_set
        if unowned:
            raise HTTPException(status_code=403, detail="Cannot modify lists not owned by you")

    norm_add_tags = {t.strip().lower()[:50] for t in payload.add_tags if t.strip()}
    norm_remove_tags = {t.strip().lower()[:50] for t in payload.remove_tags if t.strip()}

    try:
        for gid in payload.gold_ids:
            if payload.status is not None or payload.progress is not None or payload.score is not None:
                track = db.query(TrackingEntry).filter(
                    TrackingEntry.user_id == current_user.id,
                    TrackingEntry.gold_id == gid,
                ).first()
                if track is None:
                    track = TrackingEntry(user_id=current_user.id, gold_id=gid)
                    db.add(track)
                if payload.status is not None:
                    track.status = payload.status
                if payload.progress is not None:
                    track.progress = payload.progress
                if payload.score is not None:
                    track.score = payload.score

            for t in norm_add_tags:
                exists_tag = db.query(PrivateTag).filter(
                    PrivateTag.user_id == current_user.id,
                    PrivateTag.gold_id == gid,
                    PrivateTag.tag == t,
                ).first()
                if not exists_tag:
                    db.add(PrivateTag(user_id=current_user.id, gold_id=gid, tag=t))

            if norm_remove_tags:
                db.query(PrivateTag).filter(
                    PrivateTag.user_id == current_user.id,
                    PrivateTag.gold_id == gid,
                    PrivateTag.tag.in_(norm_remove_tags),
                ).delete(synchronize_session=False)

            for lid in payload.add_to_list_ids:
                exists_le = db.query(CustomListEntry).filter(
                    CustomListEntry.list_id == lid,
                    CustomListEntry.gold_id == gid,
                ).first()
                if not exists_le:
                    db.add(CustomListEntry(list_id=lid, user_id=current_user.id, gold_id=gid))

            if payload.remove_from_list_ids:
                db.query(CustomListEntry).filter(
                    CustomListEntry.user_id == current_user.id,
                    CustomListEntry.gold_id == gid,
                    CustomListEntry.list_id.in_(payload.remove_from_list_ids),
                ).delete(synchronize_session=False)

        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Bulk update failed and was rolled back") from exc

    return BulkUpdateResponse(updated_count=len(payload.gold_ids), gold_ids=payload.gold_ids)


# --- Library Export Endpoints ---


@router.get("/library/export")
def export_library(
    format: Literal["json", "csv", "xml"] = Query("json", description="Export format: json, csv, or xml"),
    scope: Literal["all", "filtered", "selected"] = Query("all", description="Export scope: all, filtered, or selected"),
    gold_ids: str | None = Query(None, description="Comma-separated gold_ids if scope is filtered or selected"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    now_iso = datetime.now(timezone.utc).isoformat()
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    target_ids: set[str] | None = None
    if gold_ids and scope in ("filtered", "selected"):
        target_ids = {g.strip() for g in gold_ids.split(",") if g.strip()}

    favorites_q = db.query(Favorite).filter(Favorite.user_id == current_user.id)
    if target_ids is not None:
        favorites_q = favorites_q.filter(Favorite.gold_id.in_(target_ids))
    favorites = favorites_q.order_by(Favorite.created_at.asc()).all()

    tracking_q = db.query(TrackingEntry).filter(TrackingEntry.user_id == current_user.id)
    if target_ids is not None:
        tracking_q = tracking_q.filter(TrackingEntry.gold_id.in_(target_ids))
    tracking = tracking_q.order_by(TrackingEntry.created_at.asc()).all()

    custom_lists = db.query(CustomList).filter(CustomList.user_id == current_user.id).order_by(CustomList.name.asc()).all()

    tags_q = db.query(PrivateTag).filter(PrivateTag.user_id == current_user.id)
    if target_ids is not None:
        tags_q = tags_q.filter(PrivateTag.gold_id.in_(target_ids))
    tags = tags_q.order_by(PrivateTag.tag.asc()).all()

    tags_by_gold: dict[str, list[str]] = {}
    for t in tags:
        tags_by_gold.setdefault(t.gold_id, []).append(t.tag)

    if format == "json":
        data = {
            "version": "mangaverse_library_v1",
            "exported_at": now_iso,
            "user": {"username": current_user.username},
            "favorites": [{"gold_id": f.gold_id, "created_at": f.created_at.isoformat()} for f in favorites],
            "tracking": [
                {
                    "gold_id": t.gold_id,
                    "status": t.status,
                    "progress": t.progress,
                    "score": t.score,
                    "notes": t.notes,
                    "updated_at": t.updated_at.isoformat(),
                }
                for t in tracking
            ],
            "custom_lists": [
                {
                    "name": l.name,
                    "description": l.description,
                    "entries": [e.gold_id for e in l.entries if (target_ids is None or e.gold_id in target_ids)],
                }
                for l in custom_lists
                if target_ids is None or any(e.gold_id in target_ids for e in l.entries)
            ],
            "private_tags": [{"gold_id": gid, "tags": tg} for gid, tg in tags_by_gold.items()],
        }
        json_bytes = json.dumps(data, indent=2).encode("utf-8")
        filename = f"mangaverse_export_{current_user.username}_{date_str}.json"
        return Response(
            content=json_bytes,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    if format == "xml":
        root = ET.Element("mangaverse_library", attrib={
            "version": "mangaverse_library_v1",
            "exported_at": now_iso,
        })
        user_el = ET.SubElement(root, "user")
        uname_el = ET.SubElement(user_el, "username")
        uname_el.text = current_user.username

        favs_el = ET.SubElement(root, "favorites")
        for f in favorites:
            ET.SubElement(favs_el, "favorite", attrib={
                "gold_id": f.gold_id,
                "created_at": f.created_at.isoformat(),
            })

        tracking_el = ET.SubElement(root, "tracking")
        for t in tracking:
            entry_el = ET.SubElement(tracking_el, "entry", attrib={"gold_id": t.gold_id})
            title = _catalog_title_getter(t.gold_id) if _catalog_title_getter else ""
            if title:
                t_title = ET.SubElement(entry_el, "title")
                t_title.text = title
            t_status = ET.SubElement(entry_el, "status")
            t_status.text = t.status
            t_prog = ET.SubElement(entry_el, "progress")
            t_prog.text = str(t.progress if t.progress is not None else 0)
            if t.score is not None:
                t_score = ET.SubElement(entry_el, "score")
                t_score.text = str(t.score)
            if t.notes:
                t_notes = ET.SubElement(entry_el, "notes")
                t_notes.text = t.notes
            t_updated = ET.SubElement(entry_el, "updated_at")
            t_updated.text = t.updated_at.isoformat()

        lists_el = ET.SubElement(root, "custom_lists")
        for l in custom_lists:
            entries_filtered = [e.gold_id for e in l.entries if (target_ids is None or e.gold_id in target_ids)]
            if entries_filtered or target_ids is None:
                list_el = ET.SubElement(lists_el, "list", attrib={"name": l.name})
                if l.description:
                    desc_el = ET.SubElement(list_el, "description")
                    desc_el.text = l.description
                entries_el = ET.SubElement(list_el, "entries")
                for gid in entries_filtered:
                    g_el = ET.SubElement(entries_el, "gold_id")
                    g_el.text = gid

        tags_el = ET.SubElement(root, "private_tags")
        for gid, tg in tags_by_gold.items():
            if target_ids is None or gid in target_ids:
                item_el = ET.SubElement(tags_el, "item", attrib={"gold_id": gid})
                for t_val in tg:
                    t_tag = ET.SubElement(item_el, "tag")
                    t_tag.text = t_val

        ET.indent(root, space="  ")
        xml_bytes = ET.tostring(root, encoding="utf-8", xml_declaration=True)
        filename = f"mangaverse_export_{current_user.username}_{date_str}.xml"
        return Response(
            content=xml_bytes,
            media_type="application/xml; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    lists_by_gold: dict[str, list[str]] = {}
    for l in custom_lists:
        for e in l.entries:
            if target_ids is None or e.gold_id in target_ids:
                lists_by_gold.setdefault(e.gold_id, []).append(l.name)

    fav_set = {f.gold_id for f in favorites}
    tracking_map = {t.gold_id: t for t in tracking}

    all_gold_ids = list(dict.fromkeys(
        [t.gold_id for t in tracking]
        + [f.gold_id for f in favorites]
        + [e.gold_id for l in custom_lists for e in l.entries if (target_ids is None or e.gold_id in target_ids)]
        + list(tags_by_gold.keys())
    ))

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "gold_id", "title", "status", "progress", "score", "favorite", "lists", "private_tags", "notes"
    ])

    for gid in all_gold_ids:
        tr = tracking_map.get(gid)
        title = _catalog_title_getter(gid) if _catalog_title_getter else ""
        writer.writerow([
            _sanitize_csv_cell(gid),
            _sanitize_csv_cell(title),
            _sanitize_csv_cell(tr.status if tr else ""),
            _sanitize_csv_cell(str(tr.progress) if tr and tr.progress is not None else ""),
            _sanitize_csv_cell(str(tr.score) if tr and tr.score is not None else ""),
            "true" if gid in fav_set else "false",
            _sanitize_csv_cell("|".join(sorted(lists_by_gold.get(gid, [])))),
            _sanitize_csv_cell(",".join(sorted(tags_by_gold.get(gid, [])))),
            _sanitize_csv_cell(tr.notes if tr and tr.notes else ""),
        ])

    csv_bytes = output.getvalue().encode("utf-8")
    filename = f"mangaverse_export_{current_user.username}_{date_str}.csv"
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# --- Preview-First Import Endpoints ---


@router.post("/library/import/preview", response_model=ImportPreviewResponse)
async def preview_import_library(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ImportPreviewResponse:
    _clean_preview_store()

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (maximum size is 5MB)")

    try:
        text = contents.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text = contents.decode("latin-1")
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Could not decode file encoding") from exc

    filename = (file.filename or "").lower()
    text_stripped = text.lstrip()
    is_json = filename.endswith(".json") or text_stripped.startswith(("{", "["))
    is_xml = filename.endswith(".xml") or text_stripped.startswith("<?xml") or (text_stripped.startswith("<") and not text_stripped.startswith("<!DOCTYPE html"))

    raw_items: list[dict] = []
    source_format = "json" if is_json else ("xml" if is_xml else "csv")

    if is_json:
        try:
            parsed = json.loads(text)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid JSON format") from exc

        if isinstance(parsed, dict) and "version" in parsed:
            tracking_map = {item["gold_id"]: item for item in parsed.get("tracking", []) if "gold_id" in item}
            fav_set = {item["gold_id"] for item in parsed.get("favorites", []) if "gold_id" in item}
            tags_map: dict[str, list[str]] = {}
            for item in parsed.get("private_tags", []):
                gid = item.get("gold_id")
                if gid and "tags" in item:
                    tags_map[gid] = item["tags"]
            lists_map: dict[str, list[str]] = {}
            for lst in parsed.get("custom_lists", []):
                lname = lst.get("name")
                if lname:
                    for gid in lst.get("entries", []):
                        lists_map.setdefault(gid, []).append(lname)

            all_gids = set(tracking_map.keys()) | fav_set | set(tags_map.keys()) | set(lists_map.keys())
            for gid in all_gids:
                tr = tracking_map.get(gid, {})
                raw_items.append({
                    "gold_id": gid,
                    "title": tr.get("title", ""),
                    "status": tr.get("status", "planning"),
                    "progress": tr.get("progress", 0),
                    "score": tr.get("score"),
                    "notes": tr.get("notes"),
                    "favorite": gid in fav_set,
                    "lists": lists_map.get(gid, []),
                    "tags": tags_map.get(gid, []),
                })
        elif isinstance(parsed, list):
            raw_items = parsed
        else:
            raise HTTPException(status_code=400, detail="Unrecognized JSON schema")
    elif is_xml:
        # Security: reject external DTD entities and XXE injection attempts
        text_lower = text.lower()
        if "<!entity" in text_lower or ("<!doctype" in text_lower and ("system" in text_lower or "public" in text_lower)):
            raise HTTPException(status_code=400, detail="External DTD entities are disabled for security")
        try:
            xml_root = ET.fromstring(text.encode("utf-8"))
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid XML format: {exc}") from exc

        if xml_root.tag == "mangaverse_library":
            tracking_map = {}
            for entry in xml_root.findall(".//tracking/entry"):
                gid = entry.attrib.get("gold_id") or ""
                title_node = entry.find("title")
                status_node = entry.find("status")
                prog_node = entry.find("progress")
                score_node = entry.find("score")
                notes_node = entry.find("notes")
                if gid:
                    tracking_map[gid] = {
                        "gold_id": gid,
                        "title": title_node.text if title_node is not None and title_node.text else "",
                        "status": status_node.text if status_node is not None and status_node.text else "planning",
                        "progress": int(prog_node.text) if prog_node is not None and prog_node.text and prog_node.text.strip().isdigit() else 0,
                        "score": float(score_node.text) if score_node is not None and score_node.text else None,
                        "notes": notes_node.text if notes_node is not None and notes_node.text else None,
                    }
            fav_set = set()
            for fav in xml_root.findall(".//favorites/favorite"):
                gid = fav.attrib.get("gold_id") or (fav.text or "").strip()
                if gid:
                    fav_set.add(gid)

            tags_map = {}
            for item in xml_root.findall(".//private_tags/item"):
                gid = item.attrib.get("gold_id") or ""
                if gid:
                    tags = [t.text.strip().lower() for t in item.findall("tag") if t.text and t.text.strip()]
                    if tags:
                        tags_map[gid] = tags

            lists_map = {}
            for lst in xml_root.findall(".//custom_lists/list"):
                lname = lst.attrib.get("name") or ""
                if lname:
                    for gid_node in lst.findall(".//entries/gold_id"):
                        gid = (gid_node.text or "").strip()
                        if gid:
                            lists_map.setdefault(gid, []).append(lname)

            all_gids = set(tracking_map.keys()) | fav_set | set(tags_map.keys()) | set(lists_map.keys())
            for gid in all_gids:
                tr = tracking_map.get(gid, {})
                raw_items.append({
                    "gold_id": gid,
                    "title": tr.get("title", ""),
                    "status": tr.get("status", "planning"),
                    "progress": tr.get("progress", 0),
                    "score": tr.get("score"),
                    "notes": tr.get("notes"),
                    "favorite": gid in fav_set,
                    "lists": lists_map.get(gid, []),
                    "tags": tags_map.get(gid, []),
                })
        else:
            manga_nodes = xml_root.findall(".//manga") or xml_root.findall(".//entry") or xml_root.findall(".//item")
            if not manga_nodes:
                raise HTTPException(status_code=400, detail="XML file does not contain recognized library entries")
            status_map = {
                "reading": "reading", "1": "reading",
                "completed": "completed", "2": "completed",
                "on-hold": "paused", "on_hold": "paused", "paused": "paused", "3": "paused",
                "dropped": "dropped", "4": "dropped",
                "plan to read": "planning", "plantoread": "planning", "planning": "planning", "6": "planning",
                "re-reading": "re_reading", "rereading": "re_reading",
            }
            for node in manga_nodes:
                gid = node.attrib.get("gold_id") or ""
                gid_node = node.find("gold_id")
                if gid_node is not None and gid_node.text:
                    gid = gid_node.text.strip()

                # Extract MAL ID / external series IDs from MAL XML export
                for mal_tag in ("manga_mangadb_id", "mal_id", "series_id", "manga_id", "id"):
                    m_el = node.find(mal_tag)
                    if m_el is not None and m_el.text and m_el.text.strip():
                        val = m_el.text.strip()
                        if val.isdigit() and not gid:
                            gid = f"mal:{val}"
                            break
                        elif ":" in val and not gid:
                            gid = val
                            break

                title = ""
                for tag_name in ("manga_title", "title", "series_title", "name"):
                    t_el = node.find(tag_name)
                    if t_el is not None and t_el.text and t_el.text.strip():
                        title = html.unescape(t_el.text.strip())
                        break

                raw_stat = ""
                for stat_tag in ("status", "my_status"):
                    s_el = node.find(stat_tag)
                    if s_el is not None and s_el.text and s_el.text.strip():
                        raw_stat = s_el.text.strip().lower()
                        break
                status_val = status_map.get(raw_stat, "planning")

                prog = 0
                for prog_tag in ("progress", "my_read_chapters", "chapters"):
                    p_el = node.find(prog_tag)
                    if p_el is not None and p_el.text and p_el.text.strip():
                        try:
                            prog = int(float(p_el.text.strip()))
                            break
                        except (ValueError, TypeError):
                            pass

                score = None
                for score_tag in ("score", "my_score"):
                    sc_el = node.find(score_tag)
                    if sc_el is not None and sc_el.text and sc_el.text.strip():
                        try:
                            s_val = float(sc_el.text.strip())
                            if s_val > 0:
                                score = s_val
                                break
                        except ValueError:
                            pass

                raw_items.append({
                    "gold_id": gid,
                    "title": title,
                    "status": status_val,
                    "progress": prog,
                    "score": score,
                    "notes": None,
                    "favorite": False,
                    "lists": [],
                    "tags": [],
                })
    else:
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            raise HTTPException(status_code=400, detail="Empty or invalid CSV file")

        def _get_val(row_dict: dict, *aliases: str) -> str:
            norm = {str(k).strip().lower(): v for k, v in row_dict.items() if k is not None}
            for a in aliases:
                v = norm.get(a.lower())
                if v is not None and str(v).strip():
                    return str(v).strip()
            return ""

        status_mapping = {
            "reading": "reading", "1": "reading",
            "completed": "completed", "2": "completed",
            "on-hold": "paused", "on_hold": "paused", "on hold": "paused", "paused": "paused", "hold": "paused", "3": "paused",
            "dropped": "dropped", "4": "dropped",
            "plan to read": "planning", "plantoread": "planning", "planning": "planning", "plan": "planning", "6": "planning",
            "re-reading": "re_reading", "rereading": "re_reading",
        }

        for row in reader:
            raw_gid = _desanitize_csv_cell(_get_val(row, "gold_id", "id", "manga_id"))
            title = _desanitize_csv_cell(_get_val(row, "title", "series_title", "manga_title", "name", "manga_name"))

            # Check source URL columns for direct canonical Gold ID extraction
            url_al = _get_val(row, "url_al", "anilist_url", "anilist")
            url_mal = _get_val(row, "url_mal", "mal_url", "myanimelist")
            url_mu = _get_val(row, "url_mu", "mangaupdates_url", "mangaupdates")
            url_any = _get_val(row, "url", "link")

            gid = raw_gid
            if not gid:
                # 1. Try AniList URL
                target_al = url_al or (url_any if "anilist.co/manga/" in url_any else "")
                if "anilist.co/manga/" in target_al:
                    al_match = re.search(r"anilist\.co/manga/(\d+)", target_al)
                    if al_match:
                        gid = f"anilist:{al_match.group(1)}"

                # 2. Try MyAnimeList URL
                if not gid:
                    target_mal = url_mal or (url_any if "myanimelist.net/manga/" in url_any else "")
                    if "myanimelist.net/manga/" in target_mal:
                        mal_match = re.search(r"myanimelist\.net/manga/(\d+)", target_mal)
                        if mal_match:
                            if _catalog_external_resolver:
                                resolved = _catalog_external_resolver("mal", mal_match.group(1))
                                if resolved:
                                    gid = resolved
                            if not gid:
                                gid = f"mal:{mal_match.group(1)}"

                # 3. Try MangaUpdates URL
                if not gid:
                    target_mu = url_mu or (url_any if "mangaupdates.com/series/" in url_any else "")
                    if "mangaupdates.com/series/" in target_mu:
                        mu_match = re.search(r"mangaupdates\.com/series/([a-zA-Z0-9]+)", target_mu)
                        if mu_match:
                            if _catalog_external_resolver:
                                resolved = _catalog_external_resolver("mu", mu_match.group(1))
                                if resolved:
                                    gid = resolved
                            if not gid:
                                gid = f"mangaupdates:{mu_match.group(1)}"

            # Status mapping
            raw_status = _desanitize_csv_cell(_get_val(row, "folder", "status", "my_status", "state", "reading_status")).lower()
            status_val = status_mapping.get(raw_status, "planning")

            # Progress / Chapter parsing (supports floats like 35.000)
            prog_raw = _desanitize_csv_cell(_get_val(row, "chapter", "progress", "chapters", "my_read_chapters", "read_chapters", "read"))
            progress = 0
            if prog_raw:
                try:
                    progress = max(0, int(float(prog_raw)))
                except (ValueError, TypeError):
                    progress = 0

            # Score parsing
            score_raw = _desanitize_csv_cell(_get_val(row, "score", "my_score", "rating", "user_score"))
            score = None
            if score_raw:
                try:
                    s_val = float(score_raw)
                    if s_val > 0:
                        score = s_val
                except (ValueError, TypeError):
                    score = None

            # Favorite, lists, tags, notes
            fav_str = _desanitize_csv_cell(_get_val(row, "favorite", "fav", "starred")).lower()
            favorite = fav_str in ("true", "1", "yes")

            lists_str = _desanitize_csv_cell(_get_val(row, "lists", "custom_lists"))
            lists = [l.strip() for l in lists_str.split("|") if l.strip()] if lists_str else []

            tags_str = _desanitize_csv_cell(_get_val(row, "private_tags", "tags"))
            tags = [t.strip().lower() for t in re.split(r"[,|]", tags_str) if t.strip()] if tags_str else []

            notes_val = _desanitize_csv_cell(_get_val(row, "notes", "comments", "my_comments"))

            raw_items.append({
                "gold_id": gid,
                "title": title,
                "status": status_val,
                "progress": progress,
                "score": score,
                "notes": notes_val or None,
                "favorite": favorite,
                "lists": lists,
                "tags": tags,
            })

    if len(raw_items) > 2000:
        raise HTTPException(status_code=400, detail="File contains more than 2000 items (maximum allowed)")

    valid_items: list[dict] = []
    skipped_rows: list[dict[str, str]] = []
    matched_entries: list[dict] = []
    conflicts_count = 0

    existing_tracking = {
        t.gold_id: t for t in db.query(TrackingEntry).filter(TrackingEntry.user_id == current_user.id).all()
    }

    for idx, item in enumerate(raw_items, start=1):
        gid = str(item.get("gold_id") or "").strip()
        title = str(item.get("title") or "").strip()

        matched_gid: str | None = None
        if gid and _safe_validate_catalog_id(gid, title):
            matched_gid = gid

        # Priority 1: Check external ID resolver (e.g. mal:151150)
        if not matched_gid and gid and ":" in gid and _catalog_external_resolver:
            prefix, ext_id = gid.split(":", 1)
            matched_gid = _catalog_external_resolver(prefix, ext_id)

        # Priority 2: Comprehensive title resolver (matches all 857,000+ title variants, Romaji, English, clean, subtitle splits)
        if not matched_gid and title and _catalog_title_resolver:
            matched_gid = _catalog_title_resolver(title)

        # Fallback: Valid formatted external Gold ID (e.g. mal:182242) -> ensure record so it's never skipped
        if not matched_gid and gid and re.match(r"^(anilist|mal|mangadex|mangaupdates|custom):[a-zA-Z0-9_\-]+$", gid):
            if _safe_validate_catalog_id(gid, title, allow_create=True):
                matched_gid = gid

        if not matched_gid:
            skipped_rows.append({
                "row": f"#{idx} {title or gid or 'Unknown'}",
                "reason": "Manga title not found in catalog or ambiguous",
            })
            continue

        catalog_title = _catalog_title_getter(matched_gid) if _catalog_title_getter else ""
        if not catalog_title or catalog_title == matched_gid:
            catalog_title = title or matched_gid

        valid_statuses = ("reading", "completed", "planning", "paused", "dropped", "re_reading")
        stat = str(item.get("status") or "planning").lower()
        if stat not in valid_statuses:
            stat = "planning"

        has_conflict = False
        if matched_gid in existing_tracking:
            curr = existing_tracking[matched_gid]
            if curr.status != stat or (item.get("score") is not None and curr.score != item.get("score")):
                has_conflict = True

        if has_conflict:
            conflicts_count += 1

        entry_data = {
            "gold_id": matched_gid,
            "title": catalog_title,
            "status": stat,
            "progress": int(item.get("progress") or 0),
            "score": float(item["score"]) if item.get("score") is not None else None,
            "notes": str(item.get("notes") or "").strip() or None,
            "favorite": bool(item.get("favorite")),
            "lists": [str(l).strip()[:100] for l in (item.get("lists") or []) if str(l).strip()],
            "tags": [str(t).strip().lower()[:50] for t in (item.get("tags") or []) if str(t).strip()],
        }
        valid_items.append(entry_data)
        matched_entries.append({
            "gold_id": matched_gid,
            "title": catalog_title,
            "status": stat,
            "has_conflict": has_conflict,
        })

    token = uuid.uuid4().hex
    _PREVIEW_STORE[token] = {
        "user_id": current_user.id,
        "created_at": time.time(),
        "items": valid_items,
    }

    return ImportPreviewResponse(
        preview_token=token,
        source_format=source_format,
        total_rows=len(raw_items),
        valid_rows=len(valid_items),
        skipped_rows=skipped_rows,
        matched_entries=matched_entries[:100],
        conflicts_count=conflicts_count,
    )


@router.post("/library/import/commit", response_model=ImportCommitResponse)
def commit_import_library(
    payload: ImportCommitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ImportCommitResponse:
    _clean_preview_store()
    preview_data = _PREVIEW_STORE.get(payload.preview_token)
    if not preview_data or preview_data["user_id"] != current_user.id:
        raise HTTPException(status_code=400, detail="Invalid, expired, or unauthorized preview token")

    items = preview_data["items"]
    replace = (payload.conflict_strategy == "replace_existing")

    imported_count = 0
    updated_count = 0

    try:
        for item in items:
            gid = item["gold_id"]
            if item["favorite"]:
                fav = db.query(Favorite).filter(
                    Favorite.user_id == current_user.id,
                    Favorite.gold_id == gid,
                ).first()
                if not fav:
                    db.add(Favorite(user_id=current_user.id, gold_id=gid))

            track = db.query(TrackingEntry).filter(
                TrackingEntry.user_id == current_user.id,
                TrackingEntry.gold_id == gid,
            ).first()

            if track is None:
                new_track = TrackingEntry(
                    user_id=current_user.id,
                    gold_id=gid,
                    status=item["status"],
                    progress=item["progress"],
                    score=item["score"],
                    notes=item["notes"],
                )
                db.add(new_track)
                imported_count += 1
            else:
                if replace:
                    track.status = item["status"]
                    track.progress = item["progress"]
                    if item["score"] is not None:
                        track.score = item["score"]
                    if item["notes"]:
                        track.notes = item["notes"]
                    updated_count += 1
                else:
                    if track.notes is None and item["notes"]:
                        track.notes = item["notes"]
                    if track.score is None and item["score"] is not None:
                        track.score = item["score"]

            for lname in item["lists"]:
                cl = db.query(CustomList).filter(
                    CustomList.user_id == current_user.id,
                    CustomList.name == lname,
                ).first()
                if not cl:
                    cl = CustomList(user_id=current_user.id, name=lname)
                    db.add(cl)
                    db.flush()
                cle = db.query(CustomListEntry).filter(
                    CustomListEntry.list_id == cl.id,
                    CustomListEntry.gold_id == gid,
                ).first()
                if not cle:
                    db.add(CustomListEntry(list_id=cl.id, user_id=current_user.id, gold_id=gid))

            for t in item["tags"]:
                pt = db.query(PrivateTag).filter(
                    PrivateTag.user_id == current_user.id,
                    PrivateTag.gold_id == gid,
                    PrivateTag.tag == t,
                ).first()
                if not pt:
                    db.add(PrivateTag(user_id=current_user.id, gold_id=gid, tag=t))

        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Import commit failed and was rolled back") from exc
    finally:
        _PREVIEW_STORE.pop(payload.preview_token, None)

    return ImportCommitResponse(
        success=True,
        imported_count=imported_count,
        updated_count=updated_count,
        skipped_count=0,
        message=f"Successfully processed {len(items)} library titles.",
    )


# --- User Profile & Settings Endpoints ---


@router.get("/profile/me", response_model=UserProfileResponse)
def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserProfileResponse:
    followers_count = db.query(UserFollow).filter(UserFollow.following_id == current_user.id).count()
    following_count = db.query(UserFollow).filter(UserFollow.follower_id == current_user.id).count()
    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        avatar_url=current_user.avatar_url,
        banner_url=current_user.banner_url,
        bio=current_user.bio,
        score_system=current_user.score_system or "point_10_decimal",
        title_language=current_user.title_language or "romaji",
        created_at=current_user.created_at.isoformat(),
        followers_count=followers_count,
        following_count=following_count,
    )


@router.patch("/profile/me", response_model=UserProfileResponse)
def update_my_profile(
    payload: UserProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserProfileResponse:
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url.strip() or None
    if payload.banner_url is not None:
        current_user.banner_url = payload.banner_url.strip() or None
    if payload.bio is not None:
        current_user.bio = payload.bio.strip() or None
    if payload.score_system is not None:
        current_user.score_system = payload.score_system
    if payload.title_language is not None:
        current_user.title_language = payload.title_language

    db.commit()
    db.refresh(current_user)

    followers_count = db.query(UserFollow).filter(UserFollow.following_id == current_user.id).count()
    following_count = db.query(UserFollow).filter(UserFollow.follower_id == current_user.id).count()
    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        avatar_url=current_user.avatar_url,
        banner_url=current_user.banner_url,
        bio=current_user.bio,
        score_system=current_user.score_system or "point_10_decimal",
        title_language=current_user.title_language or "romaji",
        created_at=current_user.created_at.isoformat(),
        followers_count=followers_count,
        following_count=following_count,
    )


@router.post("/account/password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")
    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


@router.patch("/account", response_model=UserProfileResponse)
def update_account(
    payload: AccountUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserProfileResponse:
    target_email = payload.email.lower().strip()
    if target_email != current_user.email:
        existing = db.query(User).filter(User.email == target_email).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email is already registered by another account")
        current_user.email = target_email
        db.commit()
        db.refresh(current_user)

    followers_count = db.query(UserFollow).filter(UserFollow.following_id == current_user.id).count()
    following_count = db.query(UserFollow).filter(UserFollow.follower_id == current_user.id).count()
    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        avatar_url=current_user.avatar_url,
        banner_url=current_user.banner_url,
        bio=current_user.bio,
        score_system=current_user.score_system or "point_10_decimal",
        title_language=current_user.title_language or "romaji",
        created_at=current_user.created_at.isoformat(),
        followers_count=followers_count,
        following_count=following_count,
    )


@router.get("/users/{username}", response_model=PublicUserProfileResponse)
def get_public_profile(
    username: str,
    optional_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> PublicUserProfileResponse:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    followers_count = db.query(UserFollow).filter(UserFollow.following_id == user.id).count()
    following_count = db.query(UserFollow).filter(UserFollow.follower_id == user.id).count()

    is_following = False
    if optional_user and optional_user.id != user.id:
        is_following = (
            db.query(UserFollow)
            .filter(
                UserFollow.follower_id == optional_user.id,
                UserFollow.following_id == user.id,
            )
            .first()
            is not None
        )

    return PublicUserProfileResponse(
        id=user.id,
        username=user.username,
        avatar_url=user.avatar_url,
        banner_url=user.banner_url,
        bio=user.bio,
        score_system=user.score_system or "point_10_decimal",
        created_at=user.created_at.isoformat(),
        is_following=is_following,
        followers_count=followers_count,
        following_count=following_count,
    )


@router.get("/users/{username}/tracking", response_model=TrackingListResponse)
def get_user_public_tracking(
    username: str,
    status: TrackingStatus | None = None,
    db: Session = Depends(get_db),
) -> TrackingListResponse:
    target = db.query(User).filter(User.username == username).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    query = db.query(TrackingEntry).filter(TrackingEntry.user_id == target.id)
    if status:
        query = query.filter(TrackingEntry.status == status)

    entries = query.order_by(TrackingEntry.updated_at.desc()).all()
    return TrackingListResponse(
        count=len(entries),
        entries=[_tracking_response(e) for e in entries],
    )


@router.get("/users/{username}/favorites", response_model=FavoriteListResponse)
def get_user_public_favorites(
    username: str,
    db: Session = Depends(get_db),
) -> FavoriteListResponse:
    target = db.query(User).filter(User.username == username).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    favorites = (
        db.query(Favorite)
        .filter(Favorite.user_id == target.id)
        .order_by(Favorite.created_at.desc())
        .all()
    )
    return FavoriteListResponse(
        count=len(favorites),
        favorites=[
            FavoriteResponse(gold_id=f.gold_id, created_at=f.created_at.isoformat())
            for f in favorites
        ],
    )


# --- Follow Endpoints ---


@router.post("/users/{username}/follow", response_model=FollowToggleResponse)
def toggle_follow_user(
    username: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FollowToggleResponse:
    target = db.query(User).filter(User.username == username).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    existing = (
        db.query(UserFollow)
        .filter(
            UserFollow.follower_id == current_user.id,
            UserFollow.following_id == target.id,
        )
        .first()
    )

    if existing:
        db.delete(existing)
        db.commit()
        is_following = False
    else:
        follow = UserFollow(follower_id=current_user.id, following_id=target.id)
        db.add(follow)
        notif = Notification(
            user_id=target.id,
            actor_id=current_user.id,
            type="follow",
            text=f"{current_user.username} started following you.",
        )
        db.add(notif)
        db.commit()
        is_following = True

    count = db.query(UserFollow).filter(UserFollow.following_id == target.id).count()
    return FollowToggleResponse(is_following=is_following, followers_count=count)


@router.get("/users/{username}/followers", response_model=UserFollowListResponse)
def get_user_followers(
    username: str,
    optional_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> UserFollowListResponse:
    target = db.query(User).filter(User.username == username).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    follows = db.query(UserFollow).filter(UserFollow.following_id == target.id).all()
    user_ids = [f.follower_id for f in follows]
    users = db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []

    my_following_ids = set()
    if optional_user:
        my_following = db.query(UserFollow.following_id).filter(UserFollow.follower_id == optional_user.id).all()
        my_following_ids = {f[0] for f in my_following}

    items = [
        UserFollowItem(
            id=u.id,
            username=u.username,
            avatar_url=u.avatar_url,
            bio=u.bio,
            is_following=u.id in my_following_ids,
        )
        for u in users
    ]
    return UserFollowListResponse(count=len(items), users=items)


@router.get("/users/{username}/following", response_model=UserFollowListResponse)
def get_user_following(
    username: str,
    optional_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> UserFollowListResponse:
    target = db.query(User).filter(User.username == username).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    follows = db.query(UserFollow).filter(UserFollow.follower_id == target.id).all()
    user_ids = [f.following_id for f in follows]
    users = db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []

    my_following_ids = set()
    if optional_user:
        my_following = db.query(UserFollow.following_id).filter(UserFollow.follower_id == optional_user.id).all()
        my_following_ids = {f[0] for f in my_following}

    items = [
        UserFollowItem(
            id=u.id,
            username=u.username,
            avatar_url=u.avatar_url,
            bio=u.bio,
            is_following=u.id in my_following_ids,
        )
        for u in users
    ]
    return UserFollowListResponse(count=len(items), users=items)


# --- Activity Feed Endpoints ---


@router.get("/activities", response_model=ActivityListResponse)
def list_activities(
    feed: str = Query("global", pattern="^(global|following|user)$"),
    username: str | None = None,
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    optional_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> ActivityListResponse:
    query = db.query(Activity)

    if feed == "user":
        if not username:
            raise HTTPException(status_code=400, detail="username required for user feed")
        u = db.query(User).filter(User.username == username).first()
        if not u:
            raise HTTPException(status_code=404, detail="User not found")
        query = query.filter(Activity.user_id == u.id)
    elif feed == "following":
        if not optional_user:
            raise HTTPException(status_code=401, detail="Authentication required for following feed")
        following_ids = [
            f.following_id
            for f in db.query(UserFollow).filter(UserFollow.follower_id == optional_user.id).all()
        ]
        following_ids.append(optional_user.id)
        query = query.filter(Activity.user_id.in_(following_ids))

    activities = query.order_by(Activity.created_at.desc()).offset(offset).limit(limit).all()

    liked_activity_ids = set()
    if optional_user and activities:
        act_ids = [a.id for a in activities]
        likes = (
            db.query(ActivityLike.activity_id)
            .filter(
                ActivityLike.activity_id.in_(act_ids),
                ActivityLike.user_id == optional_user.id,
            )
            .all()
        )
        liked_activity_ids = {l[0] for l in likes}

    results = []
    for a in activities:
        author = a.user
        replies = [
            ActivityReplyResponse(
                id=r.id,
                activity_id=r.activity_id,
                user_id=r.user_id,
                username=r.user.username if r.user else "Unknown",
                avatar_url=r.user.avatar_url if r.user else None,
                text=r.text,
                created_at=r.created_at.isoformat(),
            )
            for r in (a.replies or [])
        ]
        results.append(
            ActivityResponse(
                id=a.id,
                user_id=a.user_id,
                username=author.username if author else "Unknown",
                avatar_url=author.avatar_url if author else None,
                type=a.type,
                gold_id=a.gold_id,
                status=a.status,
                progress=a.progress,
                text=a.text,
                created_at=a.created_at.isoformat(),
                like_count=len(a.likes or []),
                is_liked=a.id in liked_activity_ids,
                replies_count=len(replies),
                replies=replies,
            )
        )

    return ActivityListResponse(count=len(results), activities=results)


@router.post("/activities", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
def create_text_activity(
    payload: ActivityCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ActivityResponse:
    activity = Activity(
        user_id=current_user.id,
        type="text",
        text=payload.text.strip(),
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)

    return ActivityResponse(
        id=activity.id,
        user_id=activity.user_id,
        username=current_user.username,
        avatar_url=current_user.avatar_url,
        type=activity.type,
        gold_id=None,
        status=None,
        progress=None,
        text=activity.text,
        created_at=activity.created_at.isoformat(),
        like_count=0,
        is_liked=False,
        replies_count=0,
        replies=[],
    )


@router.delete("/activities/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(
    activity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    activity = db.query(Activity).filter(Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    if activity.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this activity")

    db.delete(activity)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/activities/{activity_id}/like", response_model=ActivityLikeResponse)
def toggle_like_activity(
    activity_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ActivityLikeResponse:
    activity = db.query(Activity).filter(Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    existing = (
        db.query(ActivityLike)
        .filter(
            ActivityLike.activity_id == activity_id,
            ActivityLike.user_id == current_user.id,
        )
        .first()
    )

    if existing:
        db.delete(existing)
        db.commit()
        is_liked = False
    else:
        like = ActivityLike(activity_id=activity_id, user_id=current_user.id)
        db.add(like)
        if activity.user_id != current_user.id:
            notif = Notification(
                user_id=activity.user_id,
                actor_id=current_user.id,
                type="activity_like",
                activity_id=activity.id,
                text=f"{current_user.username} liked your activity.",
            )
            db.add(notif)
        db.commit()
        is_liked = True

    like_count = db.query(ActivityLike).filter(ActivityLike.activity_id == activity_id).count()
    return ActivityLikeResponse(activity_id=activity_id, is_liked=is_liked, like_count=like_count)


@router.post(
    "/activities/{activity_id}/replies",
    response_model=ActivityReplyResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_activity_reply(
    activity_id: int,
    payload: ActivityReplyCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ActivityReplyResponse:
    activity = db.query(Activity).filter(Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    reply = ActivityReply(
        activity_id=activity_id,
        user_id=current_user.id,
        text=payload.text.strip(),
    )
    db.add(reply)
    if activity.user_id != current_user.id:
        notif = Notification(
            user_id=activity.user_id,
            actor_id=current_user.id,
            type="activity_reply",
            activity_id=activity.id,
            text=f"{current_user.username} replied to your activity: {payload.text.strip()[:60]}",
        )
        db.add(notif)
    db.commit()
    db.refresh(reply)

    return ActivityReplyResponse(
        id=reply.id,
        activity_id=reply.activity_id,
        user_id=reply.user_id,
        username=current_user.username,
        avatar_url=current_user.avatar_url,
        text=reply.text,
        created_at=reply.created_at.isoformat(),
    )


@router.delete("/activities/{activity_id}/replies/{reply_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity_reply(
    activity_id: int,
    reply_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reply = (
        db.query(ActivityReply)
        .filter(
            ActivityReply.id == reply_id,
            ActivityReply.activity_id == activity_id,
        )
        .first()
    )
    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")
    if reply.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this reply")

    db.delete(reply)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Notification Endpoints ---


@router.get("/notifications", response_model=NotificationListResponse)
def list_notifications(
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationListResponse:
    notifs = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    unread = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.read.is_(False))
        .count()
    )
    items = [
        NotificationResponse(
            id=n.id,
            actor_username=n.actor.username if n.actor else "Someone",
            actor_avatar_url=n.actor.avatar_url if n.actor else None,
            type=n.type,
            activity_id=n.activity_id,
            text=n.text,
            read=n.read,
            created_at=n.created_at.isoformat(),
        )
        for n in notifs
    ]
    return NotificationListResponse(unread_count=unread, count=len(items), notifications=items)


@router.post("/notifications/read-all")
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read.is_(False),
    ).update({"read": True})
    db.commit()
    return {"message": "All notifications marked as read"}


@router.delete("/notifications/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notif = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
        .first()
    )
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.delete(notif)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Quick Increment Endpoint ---


@router.post("/tracking/{gold_id}/increment", response_model=ChapterIncrementResponse)
def increment_chapter_progress(
    gold_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChapterIncrementResponse:
    _require_catalog_id(gold_id)

    entry = (
        db.query(TrackingEntry)
        .filter(
            TrackingEntry.user_id == current_user.id,
            TrackingEntry.gold_id == gold_id,
        )
        .first()
    )

    if not entry:
        entry = TrackingEntry(
            user_id=current_user.id,
            gold_id=gold_id,
            status="reading",
            progress=1,
        )
        db.add(entry)
    else:
        entry.progress = (entry.progress or 0) + 1
        if entry.status == "planning":
            entry.status = "reading"

    activity = Activity(
        user_id=current_user.id,
        type="manga_list",
        gold_id=gold_id,
        status=entry.status,
        progress=entry.progress,
    )
    db.add(activity)
    db.commit()
    db.refresh(entry)

    return ChapterIncrementResponse(
        gold_id=gold_id,
        progress=entry.progress,
        status=entry.status,
        activity_created=True,
    )

