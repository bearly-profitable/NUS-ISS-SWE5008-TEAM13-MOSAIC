$root = $PSScriptRoot

# Port must match VITE_ORCH_API_BASE in frontend/.env.local — the Console
# calls the backend on an absolute URL, so Vite's dev proxy is bypassed and a
# mismatch shows up as "Not Found" on every tab.
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8055 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"

Write-Host ""
Write-Host "MOSAIC is starting in two new windows (one per service):"
Write-Host "  Console  -> http://localhost:5173"
Write-Host "  Backend  -> http://localhost:8055/api/health"
Write-Host ""
Write-Host "Close either window to stop that service."
