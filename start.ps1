$root = $PSScriptRoot

# Stop any backend left over from a previous run, whole process tree.
#
# This matters more than it looks. uvicorn spawns a worker child, and
# --reload adds a reloader parent, so a naive "kill the python running
# uvicorn" leaves an orphaned worker still holding the port. That orphan
# keeps serving the code it started with, so edits appear to do nothing and
# newly added routes 404 — while a fresh server silently fails to bind.
#
# Killing whatever owns the port (and its descendants) is the reliable form:
# it catches reloader parents, spawned workers, and the launching window.
function Stop-ProcessTree($processId) {
  Get-CimInstance Win32_Process -Filter "ParentProcessId=$processId" |
    ForEach-Object { Stop-ProcessTree $_.ProcessId }
  Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}

$owner = (Get-NetTCPConnection -State Listen -LocalPort 8055 -ErrorAction SilentlyContinue).OwningProcess
if ($owner) {
  Write-Host "Stopping the backend already on :8055 (pid $owner)"
  Stop-ProcessTree $owner
}
Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -match 'uvicorn app\.main:app' } |
  ForEach-Object { Stop-ProcessTree $_.ProcessId }
Start-Sleep -Seconds 2

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
