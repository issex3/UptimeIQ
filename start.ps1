# One-command local start for UptimeIQ (API + UI + Go agent)
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

function Ensure-Env($example, $dest) {
  if (-not (Test-Path $dest) -and (Test-Path $example)) {
    Copy-Item $example $dest
  }
}

Write-Host "UptimeIQ — starting local stack..." -ForegroundColor Cyan

Ensure-Env "$Root\backend\.env.example" "$Root\backend\.env"
Ensure-Env "$Root\frontend\.env.example" "$Root\frontend\.env"

# Backend deps
Write-Host "→ backend deps"
Push-Location "$Root\backend"
python -m pip install -q -r requirements.txt
Pop-Location

# Frontend deps
Write-Host "→ frontend deps"
Push-Location "$Root\frontend"
if (-not (Test-Path "node_modules")) { npm install --silent }
Pop-Location

# Go agent deps (module download)
Write-Host "→ agent deps"
Push-Location "$Root\agent-go"
go mod download 2>$null
Pop-Location

$api = Start-Process -PassThru -WindowStyle Minimized -FilePath "python" -ArgumentList @(
  "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8002"
) -WorkingDirectory "$Root\backend"

$ui = Start-Process -PassThru -WindowStyle Minimized -FilePath "npm" -ArgumentList @("run", "dev") -WorkingDirectory "$Root\frontend"

$agentEnv = @"
`$env:AGENT_WS_URL='ws://localhost:8002/ws/metrics'
Set-Location '$Root\agent-go'
go run .
"@
$agent = Start-Process -PassThru -WindowStyle Minimized -FilePath "powershell" -ArgumentList @(
  "-NoProfile", "-Command", $agentEnv
)

Write-Host ""
Write-Host "Running:" -ForegroundColor Green
Write-Host "  UI     http://localhost:5173"
Write-Host "  API    http://localhost:8002"
Write-Host "  Login  admin / admin123  (demo only)"
Write-Host ""
Write-Host "PIDs  api=$($api.Id)  ui=$($ui.Id)  agent=$($agent.Id)"
Write-Host "Stop with:  Stop-Process -Id $($api.Id),$($ui.Id),$($agent.Id)"
Write-Host ""
Write-Host "Opening browser..."
Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"
