"""
Database engine, session management, and ORM models for user
authentication and favorites/personalization data.

Uses settings.DATABASE_URL (SQLAlchemy-style URL) from common.config,
consistent with every other module accessing config through the
shared settings object.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    relationship,
    sessionmaker,
)

from common.config import settings


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    banner_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    score_system: Mapped[str] = mapped_column(String(20), default="point_10_decimal")
    title_language: Mapped[str] = mapped_column(String(20), default="romaji")

    favorites: Mapped[list["Favorite"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    tracking_entries: Mapped[list["TrackingEntry"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    custom_lists: Mapped[list["CustomList"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    private_tags: Mapped[list["PrivateTag"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    activities: Mapped[list["Activity"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", foreign_keys="Activity.user_id"
    )
    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", foreign_keys="Notification.user_id"
    )


class Favorite(Base):
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("user_id", "gold_id", name="uq_user_gold_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    gold_id: Mapped[str] = mapped_column(String(255), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship(back_populates="favorites")


class TrackingEntry(Base):
    __tablename__ = "tracking_entries"
    __table_args__ = (UniqueConstraint("user_id", "gold_id", name="uq_user_tracking_gold_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    gold_id: Mapped[str] = mapped_column(String(255), index=True)
    status: Mapped[str] = mapped_column(String(20), default="planning")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship(back_populates="tracking_entries")


class CustomList(Base):
    __tablename__ = "custom_lists"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_user_custom_list_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship(back_populates="custom_lists")
    entries: Mapped[list["CustomListEntry"]] = relationship(
        back_populates="custom_list", cascade="all, delete-orphan"
    )


class CustomListEntry(Base):
    __tablename__ = "custom_list_entries"
    __table_args__ = (
        UniqueConstraint("list_id", "gold_id", name="uq_list_gold_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    list_id: Mapped[int] = mapped_column(
        ForeignKey("custom_lists.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    gold_id: Mapped[str] = mapped_column(String(255), index=True)
    added_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    custom_list: Mapped["CustomList"] = relationship(back_populates="entries")


class PrivateTag(Base):
    __tablename__ = "private_tags"
    __table_args__ = (
        UniqueConstraint("user_id", "gold_id", "tag", name="uq_user_gold_tag"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    gold_id: Mapped[str] = mapped_column(String(255), index=True)
    tag: Mapped[str] = mapped_column(String(50), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship(back_populates="private_tags")


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[str] = mapped_column(String(20), default="text")  # "text" | "manga_list"
    gold_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    progress: Mapped[int | None] = mapped_column(Integer, nullable=True)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), index=True
    )

    user: Mapped["User"] = relationship(back_populates="activities", foreign_keys=[user_id])
    likes: Mapped[list["ActivityLike"]] = relationship(
        back_populates="activity", cascade="all, delete-orphan"
    )
    replies: Mapped[list["ActivityReply"]] = relationship(
        back_populates="activity",
        cascade="all, delete-orphan",
        order_by="ActivityReply.created_at.asc()",
    )


class ActivityLike(Base):
    __tablename__ = "activity_likes"
    __table_args__ = (
        UniqueConstraint("activity_id", "user_id", name="uq_activity_like_user"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    activity_id: Mapped[int] = mapped_column(
        ForeignKey("activities.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    activity: Mapped["Activity"] = relationship(back_populates="likes")
    user: Mapped["User"] = relationship()


class ActivityReply(Base):
    __tablename__ = "activity_replies"

    id: Mapped[int] = mapped_column(primary_key=True)
    activity_id: Mapped[int] = mapped_column(
        ForeignKey("activities.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    activity: Mapped["Activity"] = relationship(back_populates="replies")
    user: Mapped["User"] = relationship()


class UserFollow(Base):
    __tablename__ = "user_follows"
    __table_args__ = (
        UniqueConstraint("follower_id", "following_id", name="uq_user_follow"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    follower_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    following_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    follower: Mapped["User"] = relationship(foreign_keys=[follower_id])
    following: Mapped["User"] = relationship(foreign_keys=[following_id])


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    actor_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[str] = mapped_column(String(30))  # "activity_like" | "activity_reply" | "follow"
    activity_id: Mapped[int | None] = mapped_column(
        ForeignKey("activities.id", ondelete="CASCADE"), nullable=True
    )
    text: Mapped[str | None] = mapped_column(String(500), nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), index=True
    )

    user: Mapped["User"] = relationship(foreign_keys=[user_id], back_populates="notifications")
    actor: Mapped["User"] = relationship(foreign_keys=[actor_id])


# Normalize database URL for SQLAlchemy 2.0 (handles "postgres://" from Render/Supabase)
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# SQLite-specific directory creation
if db_url.startswith("sqlite"):
    _db_path_part = db_url.split("///")[-1]
    if _db_path_part and not _db_path_part.startswith(":memory:"):
        from pathlib import Path
        Path(_db_path_part).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    db_url,
    connect_args={"check_same_thread": False} if db_url.startswith("sqlite") else {},
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Session:
    """FastAPI dependency: yields a session, always closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables. Safe to call repeatedly - no-ops on existing tables."""
    Base.metadata.create_all(bind=engine)

    # Lightweight migration for existing SQLite databases:
    # ensure newly added columns on users table exist
    with engine.connect() as conn:
        try:
            res = conn.exec_driver_sql("PRAGMA table_info(users)")
            existing_cols = {row[1] for row in res.fetchall()}
            if "avatar_url" not in existing_cols:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500)")
            if "banner_url" not in existing_cols:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN banner_url VARCHAR(500)")
            if "bio" not in existing_cols:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN bio TEXT")
            if "score_system" not in existing_cols:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN score_system VARCHAR(20) DEFAULT 'point_10_decimal'")
            if "title_language" not in existing_cols:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN title_language VARCHAR(20) DEFAULT 'romaji'")
            conn.commit()
        except Exception:
            pass
