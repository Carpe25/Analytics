import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin || "https://analytics-two-ashen.vercel.app";
  const queryKey = req.nextUrl.searchParams.get("key") || "";
  const defaultKey = queryKey || "";

  const script = `# ==============================================================================
# Carpe Analytics MCP Tracker & Git Commit Auto-Logger Windows 1-Line Installer
# Supported: Windows 10/11 (PowerShell 5.1+ / PowerShell Core 7+)
# ==============================================================================
[CmdletBinding()]
param (
  [string]$Name = "",
  [string]$Key = "${defaultKey}",
  [string]$Url = "${origin}"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "🚀 Carpe Analytics MCP Tracker - 1-Line Auto Setup (Windows)" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Node.js
try {
  $nodeVer = & node -v
  Write-Host "✔ Node.js detected: $nodeVer" -ForegroundColor Green
} catch {
  Write-Host "❌ Error: Node.js is not found in PATH." -ForegroundColor Red
  Write-Host "Please install Node.js LTS from https://nodejs.org/ and re-run this command."
  exit 1
}

# 2. Check Git
try {
  $gitVer = & git --version
  Write-Host "✔ Git detected: $gitVer" -ForegroundColor Green
} catch {
  Write-Host "❌ Error: Git is not found in PATH." -ForegroundColor Red
  Write-Host "Please install Git for Windows from https://git-scm.com/ and re-run this command."
  exit 1
}

# 3. Detect Developer Name
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

# 4. Create ~/.carpe-tracker directory
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

Write-Host "✔ Runtime installed in $targetFile" -ForegroundColor Green

# 5. Execute Auto-Setup
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
Write-Host "3. All coding sessions and commits will now be tracked accurately!"
Write-Host ""
`;

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
