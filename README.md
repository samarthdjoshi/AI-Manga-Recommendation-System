# MangaVerse — AI Manga Discover

An end-to-end, vector-accelerated manga discovery and recommendation platform built on an entity-resolved catalog of **339,941 verified titles** aggregated across AniList, MangaDex, and MangaUpdates. Designed with an AniList-grade user experience, personalized content-based recommendation algorithms (FAISS cosine vector search), multi-format library import/export (JSON, CSV, MyAnimeList XML), and 10 dynamic appearance themes.

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Key Features](#2-key-features)
3. [Tech Stack](#3-tech-stack)
4. [Application Architecture](#4-application-architecture)
5. [Installation & Prerequisites](#5-installation--prerequisites)
6. [Environment Variables](#6-environment-variables)
7. [Running Locally](#7-running-locally)
8. [Production Build](#8-production-build)
9. [Deployment Strategy (GitHub + Vercel + Render + Supabase)](#9-deployment-strategy)
10. [Database & Authentication Architecture](#10-database--authentication-architecture)
11. [My Library & Tracking System](#11-my-library--tracking-system)
12. [Universal Import & Export Engine (JSON, CSV, MAL XML)](#12-universal-import--export-engine)
13. [Recommendation Engine & Vector Similarity](#13-recommendation-engine--vector-similarity)
14. [Project Directory Structure](#14-project-directory-structure)
15. [Future Improvements](#15-future-improvements)

---

## 1. Project Overview
MangaVerse addresses the discovery problem in the manga ecosystem, where catalog fragmentation, title variations (romaji, English, kanji), and cold-start discovery prevent readers from finding high-affinity titles. 

By unifying data from three primary APIs (**AniList**, **MangaDex**, and **MangaUpdates**) through a multi-stage entity-resolution pipeline (Bronze $\to$ Silver $\to$ Gold), MangaVerse creates a deduplicated catalog of **339,941 titles**. Titles are embedded into high-dimensional semantic vector spaces, enabling sub-10ms nearest-neighbor similarity searches and personalized recommendations derived from a user's reading history.

---

## 2. Key Features

- **Blazing Fast Vector Search**: Sub-millisecond title autocomplete and semantic catalog search across 339k+ titles.
- **Dedicated Recommendations Hub (`/recommendations`)**: Generates 60–80 personalized recommendations based on library affinity with type filters (Manga, Manhwa, Manhua), 16 genre categories, and real-time sorting.
- **AniList-Grade Reading Tracker**: 7 distinct tracking statuses (`Reading`, `Completed`, `Planning`, `Paused`, `Dropped`, `Re-Reading`, `All`), chapter progress steppers, custom 10-point decimal scoring, and personal notes.
- **Universal Library Portability**:
  - **Import**: Full support for MangaVerse Native JSON, CSV, and MyAnimeList (MAL) XML exports (e.g. `manga-list-*.xml`).
  - **Conflict Policies**: Choice of non-destructive `keep_existing` or overwrite `replace_existing`.
  - **Export**: Instant zero-loss export to JSON, CSV, or standard XML.
- **10 Dynamic Themes**: 5 Dark themes (*Violet Night*, *Midnight Navy*, *Neon Tokyo*, *Cyberpunk*, *Obsidian AMOLED*) and 5 Light themes (*Sakura Blossom*, *Ivory Classic*, *Solarized Amber*, *Matcha Garden*, *Nordic Frost*).
- **Responsive & Accessible**: Native mobile drawer, keyboard accessible search (`ArrowUp`/`ArrowDown`/`Enter`), high-contrast text ratios, and zero horizontal viewport spill.
- **AI Conversational Companion (Optional)**: Context-aware manga assistant powered by Google Gemini 2.0 Flash.

---

## 3. Tech Stack

### Frontend
- **Framework**: React 19 SPA (Single Page Application)
- **Tooling & Bundler**: Vite 8 with Rollup
- **Routing**: React Router DOM v7
- **Styling**: Tailwind CSS v3 + CSS custom property tokens
- **HTTP Client**: Axios with request cancellation & timeout interceptors

### Backend & Machine Learning
- **Framework**: Python 3.12 + FastAPI
- **ASGI Server**: Uvicorn / Gunicorn
- **Vector Search Engine**: Meta FAISS (`faiss-cpu`) with $L_2$-normalized inner product cosine similarity
- **Validation & Serialization**: Pydantic v2 + Pydantic Settings
- **ORM & Database**: SQLAlchemy 2.0 (SQLite for local zero-config; PostgreSQL / Supabase for production)
- **Security & Auth**: PyJWT (HMAC-SHA256), Passlib / Bcrypt password hashing, defused XML entity protection, CSV formula injection neutralization

---

## 4. Application Architecture

```
[ User Browser (Desktop / Mobile) ]
                 |
                 v
   [ Vercel Edge CDN / Vite SPA ]
   (HTML5 History API + SPA Rewrites)
                 |
        REST API | (JWT Bearer Auth)
                 v
     [ FastAPI Backend (Render) ]
                 |
     +-----------+-----------+
     |                       |
     v                       v
[ FAISS Index ]        [ SQLAlchemy ORM ]
(339k Vector Space)    (Users, Library, Tracking)
     |                       |
[ Gold Catalog JSON ]  [ SQLite / PostgreSQL ]
```

---

## 5. Installation & Prerequisites

### Prerequisites
- **Node.js**: v18.0.0 or higher (`node -v`)
- **Python**: v3.12 or higher (`python --version`)
- **Git**: Installed and configured

### Step 1: Clone Repository
```bash
git clone https://github.com/YOUR_USERNAME/AI-Manga-Recommendation-System.git
cd AI-Manga-Recommendation-System
```

### Step 2: Set Up Backend Python Environment
```bash
python -m venv venv312
# On Windows:
.\venv312\Scripts\activate
# On Linux/macOS:
source venv312/bin/activate

pip install -r requirements.txt
```

### Step 3: Set Up Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

---

## 6. Environment Variables

Create a `.env` file in the root directory (based on `.env.example`):

```ini
APP_NAME="MangaVerse — AI Manga Discover"
APP_ENV=development
DEBUG=True

# Comma-separated CORS origins allowed to call the API
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Database configuration (SQLite default or PostgreSQL)
DATABASE_URL=sqlite:///database/app.db

# Authentication secret (Generate via: python -c "import secrets; print(secrets.token_hex(32))")
JWT_SECRET_KEY=replace-with-a-secure-random-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRE_DAYS=30

# Optional: Google Gemini API key for AI assistant chatbot
GEMINI_API_KEY=
```

Frontend environment variables (`frontend/.env`):
```ini
# Leave empty in dev (defaults to http://127.0.0.1:8000)
# Set to your deployed Render URL in production:
VITE_API_BASE_URL=
```

---

## 7. Running Locally

### One-Click Launchers
- **Windows Batch**: Double-click `run.bat`
- **PowerShell**: Run `.\run.ps1`

### Manual Two-Terminal Method

**Terminal 1 (Backend API):**
```bash
.\venv312\Scripts\python.exe -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```
- Interactive API Swagger Docs: `http://127.0.0.1:8000/docs`

**Terminal 2 (Frontend Client):**
```bash
cd frontend
npm run dev
```
- Local Application: `http://127.0.0.1:5173`

---

## 8. Production Build

Verify the production build locally:

```bash
cd frontend
npm run build
npm run preview
```
- Production Preview URL: `http://127.0.0.1:4173`

---

## 9. Deployment Strategy

MangaVerse is architected for free and student-friendly hosting platforms:

### 1. Frontend: Deploy to Vercel
1. Push repository to **GitHub**.
2. Log into [Vercel](https://vercel.com) and click **Add New Project**.
3. Select your repository.
4. Set **Root Directory** to `frontend`.
5. Set Environment Variable:
   - `VITE_API_BASE_URL`: `https://your-mangaverse-api.onrender.com`
6. Click **Deploy**. Vercel uses `frontend/vercel.json` to handle client-side SPA routing automatically.

### 2. Backend: Deploy to Render
1. Log into [Render](https://render.com).
2. Click **New +** $\to$ **Blueprint** (or Web Service).
3. Connect your GitHub repository.
4. Render detects `render.yaml` automatically:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python -m uvicorn api.main:app --host 0.0.0.0 --port $PORT`
5. Set Environment Variables:
   - `APP_ENV`: `production`
   - `DEBUG`: `False`
   - `CORS_ALLOWED_ORIGINS`: `https://your-mangaverse.vercel.app`
   - `DATABASE_URL`: `sqlite:///database/app.db` (or Supabase connection string)

### 3. Database: Supabase (Optional)
If a persistent managed cloud database is desired:
1. Create a free project at [Supabase](https://supabase.com).
2. Copy the PostgreSQL connection URI from **Project Settings $\to$ Database**.
3. Set `DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres` in your Render service. SQLAlchemy initializes tables on startup with zero schema modifications required.

---

## 10. Database & Authentication Architecture

- **ORM Models**: SQLAlchemy Declarative models (`User`, `TrackingEntry`, `Favorite`, `CustomList`, `CustomListEntry`, `PrivateTag`, `Activity`, `ActivityReply`, `Notification`).
- **Idempotent Initialization**: The `lifespan` handler calls `init_db()` upon boot, creating indexes and tables automatically.
- **Session Handling**: Scoped database sessions injected into FastAPI endpoints using `Depends(get_db)`.
- **JWT Authentication**: Stateless, signed bearer tokens with 30-day expiry.

---

## 11. My Library & Tracking System

- **Progress Stepper**: Real-time chapter increment with instant sync.
- **Score System**: Standard 10-point decimal scale (e.g. `9.5/10`).
- **Custom Lists & Private Tags**: User-defined classification categories and tags.
- **Live Statistics**: Summary metrics displaying total titles tracked, mean score, completed series, and chapter volume.

---

## 12. Universal Import & Export Engine

### Two-Phase Import Architecture
1. **Preview Phase (`POST /auth/library/import/preview`)**:
   - Parses the uploaded `.json`, `.csv`, or `.xml` file in-memory (enforcing a strict 5MB limit).
   - Resolves external titles against the 339k Gold catalog using an $O(1)$ dictionary hash resolver (`resolve_title_to_gold_id`).
   - Identifies duplicates, new additions, and conflicts with existing library items.
   - Issues an ephemeral, cryptographic 15-minute preview token without writing to the database.
2. **Commit Phase (`POST /auth/library/import/commit`)**:
   - Accepts the preview token and user-selected policy (`keep_existing` vs `replace_existing`).
   - Performs an atomic database transaction.

### Format Specifications
- **MyAnimeList XML**: Handles `<manga_title>`, `<manga_mangadb_id>`, `<my_status>`, and decimal read chapters (`<my_read_chapters>35.000</my_read_chapters>`).
- **CSV**: Sanitized against spreadsheet formula injection (`=`, `+`, `-`, `@`).
- **JSON**: Native structured schema maintaining tracking records, custom lists, and tags.

---

## 13. Recommendation Engine & Vector Similarity

- **Algorithm**: Content-based filtering using dense embedding vectors.
- **Similarity Metric**: Cosine similarity computed via inner product on $L_2$-normalized feature representations.
- **Personalized Recommender (`/recommend/for-me`)**:
  - Aggregates high-scoring titles ($\text{score} \ge 7.0$ or status `completed`/`reading`) from the user's library.
  - Queries nearest neighbors in FAISS space.
  - Deduplicates items already in the user's library.
  - Guarantees $\ge 60$ unique recommendations with match confidence scores (e.g. `98% match`).

---

## 14. Project Directory Structure

```
AI-Manga-Recommendation-System/
├── api/                   # FastAPI application & route controllers
│   ├── main.py            # API entry point & lifespan manager
│   ├── schemas.py         # Pydantic response/request models
│   └── routes_discovery.py# Live internet discovery fallback routes
├── auth/                  # Authentication, tracking & library persistence
│   ├── database.py        # SQLAlchemy database engine & ORM models
│   ├── routes.py          # Auth, library, tracking, import/export routes
│   └── security.py        # Password hashing & JWT token issuance
├── common/                # Shared utilities, paths & configuration
│   ├── config.py          # Centralized Pydantic settings
│   └── paths.py           # Absolute directory resolvers
├── data/                  # Gold catalog & vector model stores
│   ├── gold/              # 339k verified manga records (JSON pages)
│   └── model/             # FAISS similarity index & gold ID mapping
├── database/              # SQLite persistent database storage
├── frontend/              # Vite + React 19 single page application
│   ├── src/
│   │   ├── api/client.js  # Axios API communication layer
│   │   ├── components/    # Reusable UI components (MangaCard, Header, etc.)
│   │   ├── context/       # Auth and Theme React Context providers
│   │   ├── pages/         # Page views (Home, Browse, Library, etc.)
│   │   └── styles/        # Dynamic themes & Tailwind entrypoints
│   ├── package.json       # Node package dependencies
│   ├── vercel.json        # Vercel SPA routing configuration
│   └── vite.config.js     # Vite bundler configuration
├── ml/                    # Machine learning & recommendation pipelines
│   └── recommender/       # Service layer & FAISS query handlers
├── render.yaml            # Render Blueprint deployment configuration
├── requirements.txt       # Python production dependencies
├── run.bat                # Windows 1-click launcher
├── run.ps1                # PowerShell 1-click launcher
└── vercel.json            # Root Vercel configuration
```

---

## 15. Future Improvements

1. **Collaborative Filtering**: Incorporate user-item matrix factorization (implicit ALS) alongside vector-based content filtering.
2. **Hybrid Reranking**: Re-rank recommendation candidates based on publisher freshness and release schedules.
3. **PWA Offline Support**: Enable service worker caching for offline library viewing.
4. **Push Notifications**: Browser web push alerts for new chapter releases of reading series.

---

## License
Distributed under the MIT License. Built for research and portfolio demonstration.
