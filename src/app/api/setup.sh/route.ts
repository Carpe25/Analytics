import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin || "https://analytics-two-ashen.vercel.app";
  const queryKey = req.nextUrl.searchParams.get("key") || "";
  const serverKey = process.env.TRACKER_API_KEY?.trim() || "";
  // Use query key if given, or if requested by admin with valid query
  const defaultKey = queryKey || "";

  const script = `#!/usr/bin/env bash
# ==============================================================================
# Carpe Analytics MCP Tracker & Git Commit Auto-Logger 1-Line Installer
# Supported: macOS, Linux (Ubuntu, Debian, Fedora, Arch, Snap)
# ==============================================================================
set -e

# Visual colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
BLUE='\\033[0;34m'
CYAN='\\033[0;36m'
BOLD='\\033[1m'
NC='\\033[0m' # No Color

echo -e "\\n\${CYAN}\${BOLD}🚀 Carpe Analytics MCP Tracker - 1-Line Auto Setup\${NC}"
echo -e "\${CYAN}===================================================\${NC}\\n"

# 1. Check Node.js
if ! command -v node >/dev/null 2>&1; then
  echo -e "\${RED}❌ Error: Node.js is not installed on this system.\${NC}"
  echo -e "Please install Node.js (v18+) and re-run this command."
  echo -e "  • macOS: brew install node"
  echo -e "  • Ubuntu/Debian: sudo apt update && sudo apt install -y nodejs npm"
  echo -e "  • Official: https://nodejs.org/"
  exit 1
fi

NODE_VERSION=$(node -v)
echo -e "\${GREEN}✔ Node.js detected:\${NC} \${NODE_VERSION}"

# 2. Check Git
if ! command -v git >/dev/null 2>&1; then
  echo -e "\${RED}❌ Error: Git is not installed on this system.\${NC}"
  echo -e "Please install Git and re-run this command."
  exit 1
fi
GIT_VERSION=$(git --version)
echo -e "\${GREEN}✔ Git detected:\${NC} \${GIT_VERSION}"

# Parse optional arguments
DEV_NAME=""
API_KEY="${defaultKey}"
SERVER_URL="${origin}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --name|-n)
      DEV_NAME="$2"
      shift 2
      ;;
    --key|-k)
      API_KEY="$2"
      shift 2
      ;;
    --url|-u)
      SERVER_URL="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# 3. Auto-detect Developer Name from Git if not supplied
if [ -z "$DEV_NAME" ]; then
  DEV_NAME=$(git config --global user.name 2>/dev/null || git config user.name 2>/dev/null || echo "")
fi

if [ -z "$DEV_NAME" ]; then
  DEV_NAME="$(whoami 2>/dev/null || echo "Developer")"
fi

echo -e "\${GREEN}✔ Developer identity:\${NC} \${BOLD}\${DEV_NAME}\${NC} (auto-detected from Git/system)"

# 4. Create ~/.carpe-tracker directory
INSTALL_DIR="$HOME/.carpe-tracker"
mkdir -p "$INSTALL_DIR"

BUNDLE_URL="\${SERVER_URL}/tracker.mjs"
TARGET_FILE="\${INSTALL_DIR}/tracker.mjs"

echo -e "\\n\${BLUE}⬇ Downloading tracker runtime from \${BUNDLE_URL}...\${NC}"
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "\${BUNDLE_URL}" -o "\${TARGET_FILE}"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "\${TARGET_FILE}" "\${BUNDLE_URL}"
else
  echo -e "\${RED}❌ Neither curl nor wget found.\${NC}"
  exit 1
fi

if [ ! -f "\${TARGET_FILE}" ] || [ ! -s "\${TARGET_FILE}" ]; then
  echo -e "\${RED}❌ Failed to download tracker runtime from \${BUNDLE_URL}.\${NC}"
  exit 1
fi

chmod +x "\${TARGET_FILE}"
echo -e "\${GREEN}✔ Runtime installed in \${TARGET_FILE}\${NC}"

# 5. Execute Auto-Setup
SETUP_ARGS=(setup --name "\${DEV_NAME}" --url "\${SERVER_URL}/api")
if [ -n "$API_KEY" ]; then
  SETUP_ARGS+=(--key "\${API_KEY}")
fi

echo -e "\\n\${BLUE}⚙ Configuring AI editors and dual global Git hooks...\${NC}"
node "\${TARGET_FILE}" "\${SETUP_ARGS[@]}"

echo -e "\\n\${GREEN}\${BOLD}🎉 Setup complete! All done in 1 command.\${NC}"
echo -e "\${CYAN}---------------------------------------------------\${NC}"
echo -e "1. Restart your AI editor (Cursor, Claude Desktop, Antigravity, etc.)."
echo -e "2. Your very first commit in any repo will automatically register you on the team dashboard."
echo -e "3. All coding sessions and commits will now be tracked accurately!\\n"
`;

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
