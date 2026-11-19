# ==============================================================================
# Carpe Analytics MCP Tracker & Git Commit Auto-Logger Windows 1-Line Installer
# Supported: Windows 10/11 (PowerShell 5.1+ / PowerShell Core 7+)
# ==============================================================================
[CmdletBinding()]
param (
  [string]$Name = "",
  [string]$Key = "",
  [string]$Url = "https://analytics-two-ashen.vercel.app"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "🚀 Carpe Analytics MCP Tracker - 1-Line Auto Setup (Windows)" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

try {
  $nodeVer = & node -v
  Write-Host "✔ Node.js detected: $nodeVer" -ForegroundColor Green
} catch {
  Write-Host "❌ Error: Node.js is not found in PATH." -ForegroundColor Red
  Write-Host "Please install Node.js LTS from https://nodejs.org/ and re-run this command."
  exit 1
}

try {
  $gitVer = & git --version
  Write-Host "✔ Git detected: $gitVer" -ForegroundColor Green
} catch {
  Write-Host "❌ Error: Git is not found in PATH." -ForegroundColor Red
  Write-Host "Please install Git for Windows from https://git-scm.com/ and re-run this command."
  exit 1
}

if (-not $Name) {
  try {
    $Name = (& git config --global user.name).Trim()
  } catch {}
}
if (-not $Name) {
  try {
    $Name = (& git config user.name).Trim()
  } catch {}
}
if (-not $Name) {
  $Name = $env:USERNAME
}
if (-not $Name) {
  $Name = "Developer"
}

Write-Host "✔ Developer identity: $Name (auto-detected from Git/system)" -ForegroundColor Green

$installDir = Join-Path $env:USERPROFILE ".carpe-tracker"
if (-not (Test-Path $installDir)) {
  New-Item -ItemType Directory -Force -Path $installDir | Out-Null
}

$bundleUrl = "$Url/tracker.mjs"
$targetFile = Join-Path $installDir "tracker.mjs"

Write-Host ""
Write-Host "⬇ Downloading tracker runtime from $bundleUrl..." -ForegroundColor Blue

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $bundleUrl -OutFile $targetFile -UseBasicParsing

if (-not (Test-Path $targetFile)) {
  Write-Host "❌ Failed to download tracker runtime from $bundleUrl" -ForegroundColor Red
  exit 1
}

# Cryptographic integrity verification (SHA-256)
$checksumUrl = "$Url/tracker.mjs.sha256"
try {
  $expectedHash = (Invoke-WebRequest -Uri $checksumUrl -UseBasicParsing -ErrorAction Stop).Content.Trim().ToLower()
  if ($expectedHash) {
    $actualHash = (Get-FileHash -Path $targetFile -Algorithm SHA256).Hash.ToLower()
    if ($actualHash -ne $expectedHash) {
      Write-Host "❌ SECURITY ERROR: Downloaded file integrity check FAILED!" -ForegroundColor Red
      Write-Host "Expected: $expectedHash" -ForegroundColor Red
      Write-Host "Got:      $actualHash" -ForegroundColor Red
      Write-Host "The file may have been tampered with or corrupted in transit. Aborting installation." -ForegroundColor Red
      Remove-Item -Path $targetFile -Force
      exit 1
    }
    Write-Host "✔ Runtime integrity verified: SHA-256 match" -ForegroundColor Green
  }
} catch {
  Write-Host "ℹ Checksum verification skipped (server does not provide .sha256 file)" -ForegroundColor Blue
}

Write-Host "✔ Runtime installed in $targetFile" -ForegroundColor Green

if (-not $Key) {
  Write-Host "ℹ Note: No API key provided (-Key). If your team requires API keys, re-run with: -Key YOUR_KEY" -ForegroundColor Blue
}

$setupArgs = @("setup", "--name", $Name, "--url", "$Url/api")
if ($Key) {
  $setupArgs += @("--key", $Key)
}

Write-Host ""
Write-Host "⚙ Configuring AI editors and dual global Git hooks..." -ForegroundColor Blue
& node $targetFile @setupArgs

Write-Host ""
Write-Host "🎉 Setup complete! All done in 1 command." -ForegroundColor Green
Write-Host "-----------------------------------------------------------" -ForegroundColor Cyan
Write-Host "1. Restart your AI editor (Cursor, Claude Desktop, Antigravity, etc.)."
Write-Host "2. Your very first commit in any repo will automatically register you on the team dashboard."
Write-Host "3. All coding sessions and commits will now be tracked accurately!`n"
