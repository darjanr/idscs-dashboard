#!/bin/bash
# Iva's one-time setup — run this AFTER you unzip the projects folder to your Desktop.
#
# How to run:
#   1. Unzip "CLAUDE PROJECTS.zip" to your Desktop
#   2. Open Terminal
#   3. Paste this and press Enter:
#        bash ~/Desktop/CLAUDE\ PROJECTS/idscs-dashboard/setup-iva.sh

echo ""
echo "======================================"
echo "  Setting up your git identity..."
echo "======================================"
echo ""

# ── 1. Install Command Line Tools if git is missing ───────────────────────
if ! command -v git &>/dev/null; then
  echo "Installing developer tools (git)..."
  echo "A popup will appear — click Install (NOT Get Xcode)."
  echo "This installs only the small tools package (~1GB), not the full Xcode."
  echo ""
  xcode-select --install 2>/dev/null
  echo ""
  echo "Waiting for installation to finish..."
  echo "Press Enter here once the popup says 'Software installed'."
  read -r
fi

if ! command -v git &>/dev/null; then
  echo "Git still not found — please complete the installation and run this script again."
  exit 1
fi
echo "✓ Git is ready"

# ── 2. Set your name and email so commits show as you ─────────────────────
echo ""
echo "What is your full name? (e.g. Iva Vashar)"
read -r GIT_NAME
echo "What is your work email?"
read -r GIT_EMAIL

git config --global user.name "$GIT_NAME"
git config --global user.email "$GIT_EMAIL"
echo "✓ Git configured: $GIT_NAME <$GIT_EMAIL>"

# ── 3. Connect each project folder to GitHub ──────────────────────────────
echo ""
echo "Connecting projects to GitHub..."

PROJECTS_DIR="$HOME/Desktop/CLAUDE PROJECTS"

cd "$PROJECTS_DIR/idscs-dashboard" 2>/dev/null && \
  git remote set-url origin https://github.com/darjanr/idscs-dashboard.git 2>/dev/null && \
  echo "✓ idscs-dashboard connected"

cd "$PROJECTS_DIR/fashiongroup-crm" 2>/dev/null && \
  git remote set-url origin https://github.com/darjanr/fashiongroup-crm.git 2>/dev/null && \
  echo "✓ fashiongroup-crm connected"

cd "$PROJECTS_DIR/reports-grand" 2>/dev/null && \
  git remote set-url origin https://github.com/darjanr/reports-grand.git 2>/dev/null && \
  echo "✓ reports-grand connected"

# ── 4. Move credentials to secure location ────────────────────────────────
echo ""
echo "Setting up credentials..."

CREDS_SOURCE="$PROJECTS_DIR/_credentials"
CREDS_DEST="$HOME/.credentials/reports-grand"

mkdir -p "$CREDS_DEST"
chmod 700 "$HOME/.credentials"
chmod 700 "$CREDS_DEST"

if [ -d "$CREDS_SOURCE" ]; then
  mv "$CREDS_SOURCE/"*.json "$CREDS_DEST/"
  chmod 600 "$CREDS_DEST/"*.json
  rm -rf "$CREDS_SOURCE"
  echo "✓ Credentials moved to ~/.credentials/reports-grand/"
else
  echo "⚠️  No credentials found in the zip — ask Darjan to resend."
fi

# ── 5. Set up daily auto-pull and end-of-day reminder ─────────────────────
echo ""
echo "Setting up automatic reminders..."

AUTOMATION_DIR="$PROJECTS_DIR/.git-automation"
mkdir -p "$AUTOMATION_DIR"

cat > "$AUTOMATION_DIR/auto-pull.sh" << 'SCRIPT'
#!/bin/bash
PROJECTS="$HOME/Desktop/CLAUDE PROJECTS"
for project in "idscs-dashboard" "fashiongroup-crm" "reports-grand"; do
  dir="$PROJECTS/$project"
  if [ -d "$dir/.git" ]; then
    git -C "$dir" pull --quiet 2>/dev/null
  fi
done
SCRIPT

cat > "$AUTOMATION_DIR/check-uncommitted.sh" << 'SCRIPT'
#!/bin/bash
PROJECTS="$HOME/Desktop/CLAUDE PROJECTS"
DIRTY=""
for project in "idscs-dashboard" "fashiongroup-crm" "reports-grand"; do
  dir="$PROJECTS/$project"
  if [ -d "$dir/.git" ]; then
    if ! git -C "$dir" diff --quiet 2>/dev/null || \
       ! git -C "$dir" diff --cached --quiet 2>/dev/null || \
       [ -n "$(git -C "$dir" ls-files --others --exclude-standard 2>/dev/null)" ]; then
      DIRTY="$DIRTY $project"
    fi
  fi
done
if [ -n "$DIRTY" ]; then
  osascript -e "display notification \"Unsaved changes in:$DIRTY\" with title \"Git Reminder 💾\" subtitle \"Don't forget to commit before you close!\" sound name \"Ping\""
fi
SCRIPT

chmod +x "$AUTOMATION_DIR/auto-pull.sh"
chmod +x "$AUTOMATION_DIR/check-uncommitted.sh"

LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
mkdir -p "$LAUNCH_AGENTS"

cat > "$LAUNCH_AGENTS/mk.zhar.git-auto-pull.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>mk.zhar.git-auto-pull</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$HOME/Desktop/CLAUDE PROJECTS/.git-automation/auto-pull.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>9</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardErrorPath</key>
  <string>/tmp/git-auto-pull.log</string>
</dict>
</plist>
PLIST

cat > "$LAUNCH_AGENTS/mk.zhar.git-reminder.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>mk.zhar.git-reminder</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$HOME/Desktop/CLAUDE PROJECTS/.git-automation/check-uncommitted.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>17</integer>
    <key>Minute</key>
    <integer>30</integer>
  </dict>
  <key>StandardErrorPath</key>
  <string>/tmp/git-reminder.log</string>
</dict>
</plist>
PLIST

launchctl load "$LAUNCH_AGENTS/mk.zhar.git-auto-pull.plist" 2>/dev/null
launchctl load "$LAUNCH_AGENTS/mk.zhar.git-reminder.plist" 2>/dev/null

echo "✓ Auto-pull every morning at 09:00"
echo "✓ Reminder every day at 17:30 if you have unsaved changes"

# ── 6. Done ────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  All done! You're ready to work."
echo ""
echo "  Checklist:"
echo "  ✓ Git identity set"
echo "  ✓ Projects connected to GitHub"
echo "  ✓ Daily auto-pull at 09:00"
echo "  ✓ End-of-day reminder at 17:30"
echo ""
echo "  Read WORKFLOW.md in any project folder"
echo "  for daily commands."
echo "============================================"
echo ""
