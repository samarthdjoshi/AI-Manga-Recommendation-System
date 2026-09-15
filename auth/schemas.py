"""
Pydantic request/response models for authentication endpoints.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, EmailStr, Field


TrackingStatus = Literal["reading", "completed", "planning", "paused", "dropped", "re_reading"]


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str


class ResetPasswordRequest(BaseModel):
    email: str
    new_password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: int
    email: str
    username: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class FavoriteResponse(BaseModel):
    gold_id: str
    created_at: str


class FavoriteListResponse(BaseModel):
    count: int
    favorites: list[FavoriteResponse]


class TrackingUpsertRequest(BaseModel):
    status: TrackingStatus = "planning"
    progress: int = Field(default=0, ge=0, le=100000)
    score: float | None = Field(default=None, ge=0, le=10)
    notes: str | None = Field(default=None, max_length=2000)


class TrackingResponse(BaseModel):
    gold_id: str
    status: TrackingStatus
    progress: int
    score: float | None
    notes: str | None
    updated_at: str


class TrackingListResponse(BaseModel):
    count: int
    entries: list[TrackingResponse]


# --- Custom Lists Schemas ---


class CustomListCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class CustomListUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class CustomListResponse(BaseModel):
    id: int
    name: str
    description: str | None
    entry_count: int
    created_at: str
    updated_at: str


class CustomListDetailResponse(BaseModel):
    id: int
    name: str
    description: str | None
    entries: list[str]
    created_at: str
    updated_at: str


class CustomListsListResponse(BaseModel):
    count: int
    lists: list[CustomListResponse]


# --- Private Tags Schemas ---


class PrivateTagSetRequest(BaseModel):
    tags: list[str] = Field(default_factory=list, max_length=50)


class PrivateTagResponse(BaseModel):
    gold_id: str
    tags: list[str]


class UserTagsResponse(BaseModel):
    tags_by_gold_id: dict[str, list[str]]


# --- Bulk Edit Schemas ---


class BulkUpdateRequest(BaseModel):
    gold_ids: list[str] = Field(min_length=1, max_length=200)
    status: TrackingStatus | None = None
    progress: int | None = Field(default=None, ge=0, le=100000)
    score: float | None = Field(default=None, ge=0, le=10)
    add_tags: list[str] = Field(default_factory=list, max_length=20)
    remove_tags: list[str] = Field(default_factory=list, max_length=20)
    add_to_list_ids: list[int] = Field(default_factory=list, max_length=20)
    remove_from_list_ids: list[int] = Field(default_factory=list, max_length=20)


class BulkUpdateResponse(BaseModel):
    updated_count: int
    gold_ids: list[str]


# --- Import / Export Schemas ---


class ImportPreviewResponse(BaseModel):
    preview_token: str
    source_format: str
    total_rows: int
    valid_rows: int
    skipped_rows: list[dict[str, str]]
    matched_entries: list[dict]
    conflicts_count: int


class ImportCommitRequest(BaseModel):
    preview_token: str
    conflict_strategy: Literal["keep_existing", "replace_existing"] = "keep_existing"


class ImportCommitResponse(BaseModel):
    success: bool
    imported_count: int
    updated_count: int
    skipped_count: int
    message: str


# --- User Profile & Settings Schemas ---


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class AccountUpdateRequest(BaseModel):
    email: EmailStr


class UserProfileUpdateRequest(BaseModel):
    avatar_url: str | None = Field(default=None, max_length=500)
    banner_url: str | None = Field(default=None, max_length=500)
    bio: str | None = Field(default=None, max_length=5000)
    score_system: Literal["point_100", "point_10_decimal", "point_10", "point_5", "point_3"] | None = None
    title_language: Literal["romaji", "english", "native"] | None = None


class UserProfileResponse(BaseModel):
    id: int
    email: str
    username: str
    avatar_url: str | None = None
    banner_url: str | None = None
    bio: str | None = None
    score_system: str = "point_10_decimal"
    title_language: str = "romaji"
    created_at: str
    followers_count: int = 0
    following_count: int = 0


class PublicUserProfileResponse(BaseModel):
    id: int
    username: str
    avatar_url: str | None = None
    banner_url: str | None = None
    bio: str | None = None
    score_system: str = "point_10_decimal"
    created_at: str
    is_following: bool = False
    followers_count: int = 0
    following_count: int = 0


# --- Social & Activity Schemas ---


class ActivityCreateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)


class ActivityReplyCreateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class ActivityReplyResponse(BaseModel):
    id: int
    activity_id: int
    user_id: int
    username: str
    avatar_url: str | None = None
    text: str
    created_at: str


class ActivityResponse(BaseModel):
    id: int
    user_id: int
    username: str
    avatar_url: str | None = None
    type: str  # "text" | "manga_list"
    gold_id: str | None = None
    status: str | None = None
    progress: int | None = None
    text: str | None = None
    created_at: str
    like_count: int = 0
    is_liked: bool = False
    replies_count: int = 0
    replies: list[ActivityReplyResponse] = []


class ActivityListResponse(BaseModel):
    count: int
    activities: list[ActivityResponse]


class ActivityLikeResponse(BaseModel):
    activity_id: int
    is_liked: bool
    like_count: int


# --- User Follows Schemas ---


class UserFollowItem(BaseModel):
    id: int
    username: str
    avatar_url: str | None = None
    bio: str | None = None
    is_following: bool = False


class UserFollowListResponse(BaseModel):
    count: int
    users: list[UserFollowItem]


class FollowToggleResponse(BaseModel):
    is_following: bool
    followers_count: int


# --- Notifications Schemas ---


class NotificationResponse(BaseModel):
    id: int
    actor_username: str
    actor_avatar_url: str | None = None
    type: str
    activity_id: int | None = None
    text: str | None = None
    read: bool
    created_at: str


class NotificationListResponse(BaseModel):
    unread_count: int
    count: int
    notifications: list[NotificationResponse]


# --- Quick Increment Schema ---


class ChapterIncrementResponse(BaseModel):
    gold_id: str
    progress: int
    status: str
    activity_created: bool

