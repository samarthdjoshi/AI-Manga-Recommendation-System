@echo off
title MangaVerse Launcher
echo ========================================================
echo               MangaVerse System Launcher
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Starting FastAPI Backend on http://127.0.0.1:8000...
start "MangaVerse Backend (FastAPI)" cmd /k "cd /d "%~dp0" && .\venv312\Scripts\python.exe -m uvicorn api.main:app --host 127.0.0.1 --port 8000"

echo [2/3] Waiting for backend initialization...
timeout /t 3 /nobreak >nul

echo [3/3] Starting Vite Frontend on http://127.0.0.1:5173...
start "MangaVerse Frontend (Vite)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

timeout /t 2 /nobreak >nul
echo.
echo ========================================================
echo All services launched!
echo - Backend:  http://127.0.0.1:8000/docs
echo - Frontend: http://127.0.0.1:5173
echo ========================================================
echo Opening browser...
start http://127.0.0.1:5173
