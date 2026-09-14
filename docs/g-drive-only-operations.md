# G-drive-only operations

This checkout is intentionally isolated at:

`G:\AI-Manga-Recommendation-System-AG`

Its original D-drive copy is a separate project. Do not run build, test, or
server commands from the D-drive copy when working on this checkout.

## Use this Python interpreter

Run project Python commands with:

```powershell
G:\AI-Manga-Recommendation-System-AG\venv312\Scripts\python.exe
```

The G-drive virtual environment has been verified to resolve project packages
from G only. Avoid using a system Python interpreter for this repository.

## Start the local application

Open a PowerShell window in the G-drive project folder and run the API:

```powershell
Set-Location "G:\AI-Manga-Recommendation-System-AG"
.\venv312\Scripts\python.exe -m uvicorn api.main:app --reload
```

In a second PowerShell window, run the frontend:

```powershell
Set-Location "G:\AI-Manga-Recommendation-System-AG\frontend"
npm run dev
```

Then open `http://127.0.0.1:5173`.

## Verify before any data rebuild

Always begin from the G project root:

```powershell
Set-Location "G:\AI-Manga-Recommendation-System-AG"
.\venv312\Scripts\python.exe -c "from common.paths import PROJECT_ROOT; print(PROJECT_ROOT)"
```

The command must print:

```text
G:\AI-Manga-Recommendation-System-AG
```

Both build scripts now refuse to run when the shell directory and the imported
project root differ. This is a deliberate protection against writing generated
data to another copy of the repository.

## Safe G-only data rebuild

Data rebuilds replace generated Silver and Gold folders. Create G-local
backups first, then run the build commands from the G root:

```powershell
Set-Location "G:\AI-Manga-Recommendation-System-AG"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item .\data\silver ".\data\silver.backup-$stamp" -Recurse
Copy-Item .\data\gold ".\data\gold.backup-$stamp" -Recurse
.\venv312\Scripts\python.exe .\scripts\build_silver.py
.\venv312\Scripts\python.exe .\scripts\build_gold.py
```

Confirm each build reports a destination beneath
`G:\AI-Manga-Recommendation-System-AG\data`. If it reports any other drive or
folder, stop immediately; the safety guard should have prevented writes.

## Quality checks

From the G project root:

```powershell
.\venv312\Scripts\python.exe -m pytest -q
Set-Location .\frontend
npm run lint
npm run build
```

The full real-catalog smoke test is intentionally opt-in because it loads the
complete catalog:

```powershell
$env:RUN_REAL_CATALOG_TESTS = "1"
..\venv312\Scripts\python.exe -m pytest tests\api\test_real_catalog_smoke.py -q
Remove-Item Env:RUN_REAL_CATALOG_TESTS
```

## Configuration and secrets

Copy `.env.example` to `.env` for local configuration. Keep `.env` private and
never commit it. Production requires a unique `JWT_SECRET_KEY` and explicit
`CORS_ALLOWED_ORIGINS`; the application rejects the documented development JWT
key when `APP_ENV=production`.
