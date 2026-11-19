#!/usr/bin/env bash
# ==============================================================================
# Carpe Analytics MCP Tracker & Git Commit Auto-Logger 1-Line Installer
# Supported: macOS, Linux (Ubuntu, Debian, Fedora, Arch, Snap)
# ==============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "\n${CYAN}${BOLD}🚀 Carpe Analytics MCP Tracker - 1-Line Auto Setup${NC}"
echo -e "${CYAN}===================================================${NC}\n"

if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}❌ Error: Node.js is not installed on this system.${NC}"
  echo -e "Please install Node.js (v18+) and re-run this command."
  echo -e "  • macOS: brew install node"
  echo -e "  • Ubuntu/Debian: sudo apt update && sudo apt install -y nodejs npm"
  echo -e "  • Official: https://nodejs.org/"
  exit 1
fi
echo -e "${GREEN}✔ Node.js detected:${NC} $(node -v)"

if ! command -v git >/dev/null 2>&1; then
  echo -e "${RED}❌ Error: Git is not installed on this system.${NC}"
  echo -e "Please install Git and re-run this command."
  exit 1
fi
echo -e "${GREEN}✔ Git detected:${NC} $(git --version)"

DEV_NAME=""
API_KEY=""
SERVER_URL="https://analytics-two-ashen.vercel.app"

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

if [ -z "$DEV_NAME" ]; then
  DEV_NAME=$(git config --global user.name 2>/dev/null || git config user.name 2>/dev/null || echo "")
fi

if [ -z "$DEV_NAME" ]; then
  DEV_NAME="$(whoami 2>/dev/null || echo "Developer")"
fi

echo -e "${GREEN}✔ Developer identity:${NC} ${BOLD}${DEV_NAME}${NC} (auto-detected from Git/system)"

INSTALL_DIR="$HOME/.carpe-tracker"
mkdir -p "$INSTALL_DIR"

BUNDLE_URL="${SERVER_URL}/tracker.mjs"
TARGET_FILE="${INSTALL_DIR}/tracker.mjs"

echo -e "\n${BLUE}⬇ Downloading tracker runtime from ${BUNDLE_URL}...${NC}"
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "${BUNDLE_URL}" -o "${TARGET_FILE}"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "${TARGET_FILE}" "${BUNDLE_URL}"
else
  echo -e "${RED}❌ Neither curl nor wget found.${NC}"
  exit 1
fi

# Cryptographic integrity verification (SHA-256)
CHECKSUM_URL="${SERVER_URL}/tracker.mjs.sha256"
EXPECTED_HASH=""
if command -v curl >/dev/null 2>&1; then
  EXPECTED_HASH=$(curl -fsSL "${CHECKSUM_URL}" 2>/dev/null | tr -d '[:space:]' || echo "")
elif command -v wget >/dev/null 2>&1; then
  EXPECTED_HASH=$(wget -qO- "${CHECKSUM_URL}" 2>/dev/null | tr -d '[:space:]' || echo "")
fi

if [ -n "$EXPECTED_HASH" ]; then
  ACTUAL_HASH=""
  if command -v sha256sum >/dev/null 2>&1; then
    ACTUAL_HASH=$(sha256sum "${TARGET_FILE}" | awk '{print $1}')
  elif command -v shasum >/dev/null 2>&1; then
    ACTUAL_HASH=$(shasum -a 256 "${TARGET_FILE}" | awk '{print $1}')
  fi

  if [ -n "$ACTUAL_HASH" ] && [ "$ACTUAL_HASH" != "$EXPECTED_HASH" ]; then
    echo -e "${RED}❌ SECURITY ERROR: Downloaded file integrity check FAILED!${NC}"
    echo -e "${RED}Expected: ${EXPECTED_HASH}${NC}"
    echo -e "${RED}Got:      ${ACTUAL_HASH}${NC}"
    echo -e "${RED}The file may have been tampered with or corrupted in transit. Aborting installation.${NC}"
    rm -f "${TARGET_FILE}"
    exit 1
  fi
  echo -e "${GREEN}✔ Runtime integrity verified:${NC} SHA-256 match"
else
  echo -e "${BLUE}ℹ Checksum verification skipped (server does not provide .sha256 file)${NC}"
fi

chmod +x "${TARGET_FILE}"
echo -e "${GREEN}✔ Runtime installed in ${TARGET_FILE}${NC}"

if [ -z "$API_KEY" ]; then
  echo -e "${BLUE}ℹ Note: No API key provided (--key). If your team requires API keys, re-run with: --key YOUR_KEY${NC}"
fi

SETUP_ARGS=(setup --name "${DEV_NAME}" --url "${SERVER_URL}/api")
if [ -n "$API_KEY" ]; then
  SETUP_ARGS+=(--key "${API_KEY}")
fi

echo -e "\n${BLUE}⚙ Configuring AI editors and dual global Git hooks...${NC}"
node "${TARGET_FILE}" "${SETUP_ARGS[@]}"

echo -e "\n${GREEN}${BOLD}🎉 Setup complete! All done in 1 command.${NC}"
echo -e "${CYAN}---------------------------------------------------${NC}"
echo -e "1. Restart your AI editor (Cursor, Claude Desktop, Antigravity, etc.)."
echo -e "2. Your very first commit in any repo will automatically register you on the team dashboard."
echo -e "3. All coding sessions and commits will now be tracked accurately!\n"
