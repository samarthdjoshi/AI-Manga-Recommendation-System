# MangaVerse PowerShell Runner
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "             MangaVerse System Launcher                 " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $rootDir

Write-Host "`n[1/3] Starting FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Yellow
$backendProcess = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir'; & '.\venv312\Scripts\python.exe' -m uvicorn api.main:app --host 127.0.0.1 --port 8000" -PassThru

Start-Sleep -Seconds 3

Write-Host "[2/3] Starting Vite Frontend on http://127.0.0.1:5173..." -ForegroundColor Green
$frontendProcess = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir\frontend'; npm run dev" -PassThru

Start-Sleep -Seconds 2

Write-Host "`n[3/3] Opening browser..." -ForegroundColor Magenta
Start-Process "http://127.0.0.1:5173"

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "Both servers are running in separate terminal windows:" -ForegroundColor Cyan
Write-Host "  - Frontend: http://127.0.0.1:5173" -ForegroundColor White
Write-Host "  - Backend:  http://127.0.0.1:8000 (API Docs: http://127.0.0.1:8000/docs)" -ForegroundColor White
Write-Host "To stop the servers, simply close their terminal windows." -ForegroundColor Gray
Write-Host "========================================================" -ForegroundColor Cyan
