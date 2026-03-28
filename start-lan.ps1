Write-Host "Starting Factory UI V2 (LAN mode)..." -ForegroundColor Cyan

# Create logs directory
New-Item -ItemType Directory -Force -Path logs | Out-Null

# Detect LAN IP
$lanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -match "^(192\.168\.|10\.|172\.)"
} | Select-Object -First 1).IPAddress

if (-not $lanIp) {
    $lanIp = "0.0.0.0"
    Write-Host "Could not detect LAN IP, binding to 0.0.0.0" -ForegroundColor Yellow
}

# Kill stale processes on ports 8000, 3000
foreach ($port in 8000, 3000) {
    $pids = netstat -ano | Select-String ":$port\s" | ForEach-Object {
        ($_ -split '\s+')[-1]
    } | Sort-Object -Unique
    foreach ($pid in $pids) {
        if ($pid -and $pid -ne "0") {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
    }
}

# Start backend
Write-Host "Starting backend on :8000..." -ForegroundColor Green
$backend = Start-Process -NoNewWindow -PassThru -FilePath "py" `
    -ArgumentList "-m", "uvicorn", "backend.main:app", "--reload", "--port", "8000", "--host", "0.0.0.0" `
    -RedirectStandardOutput "logs\backend.log" -RedirectStandardError "logs\backend-err.log"

# Start frontend
Write-Host "Starting frontend on :3000..." -ForegroundColor Green
$frontend = Start-Process -NoNewWindow -PassThru -WorkingDirectory "frontend" `
    -FilePath "pnpm" -ArgumentList "dev", "--hostname", "0.0.0.0" `
    -RedirectStandardOutput "..\logs\frontend.log" -RedirectStandardError "..\logs\frontend-err.log"

Write-Host ""
Write-Host "Backend:  http://${lanIp}:8000" -ForegroundColor Green
Write-Host "Frontend: http://${lanIp}:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Access from your phone at: http://${lanIp}:3000" -ForegroundColor Magenta
Write-Host "Press Ctrl+C to stop." -ForegroundColor Yellow

try {
    Wait-Process -Id $backend.Id, $frontend.Id
} finally {
    Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue
    Write-Host "Shutdown complete." -ForegroundColor Cyan
}
