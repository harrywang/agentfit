#!/usr/bin/env bash
set -euo pipefail

# ─── AgentFit Installer ─────────────────────────────────────────────
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/harrywang/agentfit/main/setup.sh | bash
#
# Or clone manually:
#   git clone https://github.com/harrywang/agentfit.git && cd agentfit && ./setup.sh
# ─────────────────────────────────────────────────────────────────────

REPO="https://github.com/harrywang/agentfit.git"
DIR="agentfit"
PORT="${AGENTFIT_PORT:-3000}"

info()  { printf "\033[1;34m==>\033[0m %s\n" "$1"; }
ok()    { printf "\033[1;32m==>\033[0m %s\n" "$1"; }
error() { printf "\033[1;31m==>\033[0m %s\n" "$1" >&2; }

# ─── Prerequisites ───────────────────────────────────────────────────

command -v node >/dev/null 2>&1 || { error "Node.js is required. Install it from https://nodejs.org"; exit 1; }
command -v npm  >/dev/null 2>&1 || { error "npm is required. It ships with Node.js."; exit 1; }

NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
if [ "$NODE_MAJOR" -lt 20 ]; then
  error "Node.js 20+ is required (found v$(node -v)). Please upgrade."
  exit 1
fi

# ─── Clone (skip if already inside the repo) ────────────────────────

if [ ! -f "package.json" ] || ! grep -q '"agentfit"' package.json 2>/dev/null; then
  if [ -d "$DIR" ]; then
    info "Directory '$DIR' already exists — pulling latest..."
    cd "$DIR"
    git pull --ff-only
  else
    info "Cloning AgentFit..."
    git clone "$REPO" "$DIR"
    cd "$DIR"
  fi
fi

# ─── Install ─────────────────────────────────────────────────────────

info "Installing dependencies..."
npm install

# ─── Database ────────────────────────────────────────────────────────

info "Setting up database..."
npx prisma migrate deploy

# ─── Build ───────────────────────────────────────────────────────────

info "Building production bundle..."
npm run build

# ─── Done ────────────────────────────────────────────────────────────

ok "AgentFit is ready!"
echo ""
echo "  Start the dashboard:"
echo "    cd ${DIR} && npm start"
echo ""
echo "  Or run in dev mode:"
echo "    cd ${DIR} && npm run dev"
echo ""
echo "  Then open http://localhost:${PORT}"
echo ""
