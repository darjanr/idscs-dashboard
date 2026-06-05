#!/bin/bash
# One-time setup for Iva — run this once and you're ready to work.
# How to run: open Terminal, paste this line and press Enter:
#   bash ~/Downloads/setup-iva.sh

echo ""
echo "======================================"
echo "  Setting up your projects folder..."
echo "======================================"
echo ""

# ── 1. Check git is installed ──────────────────────────────────────────────
if ! command -v git &>/dev/null; then
  echo "Git is not installed."
  echo "Please install it from: https://git-scm.com/download/mac"
  echo "Then run this script again."
  exit 1
fi
echo "✓ Git is installed"

# ── 2. Configure your name and email in git ────────────────────────────────
echo ""
echo "What is your full name? (e.g. Iva Vashar)"
read -r GIT_NAME
echo "What is your work email?"
read -r GIT_EMAIL

git config --global user.name "$GIT_NAME"
git config --global user.email "$GIT_EMAIL"
echo "✓ Git configured for $GIT_NAME <$GIT_EMAIL>"

# ── 3. Create projects folder on Desktop ──────────────────────────────────
PROJECTS_DIR="$HOME/Desktop/CLAUDE PROJECTS"
mkdir -p "$PROJECTS_DIR"
echo "✓ Projects folder ready at: $PROJECTS_DIR"

# ── 4. Clone all three project repos ──────────────────────────────────────
echo ""
echo "Downloading projects from GitHub..."
echo "(You may be asked for your GitHub username and password)"
echo ""

cd "$PROJECTS_DIR"

if [ ! -d "idscs-dashboard/.git" ]; then
  git clone https://github.com/darjanr/idscs-dashboard.git
  echo "✓ idscs-dashboard downloaded"
else
  echo "✓ idscs-dashboard already exists, skipping"
fi

if [ ! -d "fashiongroup-crm/.git" ]; then
  git clone https://github.com/darjanr/fashiongroup-crm.git
  echo "✓ fashiongroup-crm downloaded"
else
  echo "✓ fashiongroup-crm already exists, skipping"
fi

if [ ! -d "reports-grand/.git" ]; then
  git clone https://github.com/darjanr/reports-grand.git
  echo "✓ reports-grand downloaded"
else
  echo "✓ reports-grand already exists, skipping"
fi

# ── 5. Done ────────────────────────────────────────────────────────────────
echo ""
echo "======================================"
echo "  All done! Your projects are at:"
echo "  Desktop → CLAUDE PROJECTS"
echo ""
echo "  Read WORKFLOW.md in any project"
echo "  folder to see daily commands."
echo "======================================"
echo ""
