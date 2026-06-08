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

# ── 5. Create credentials folder ──────────────────────────────────────────
echo ""
echo "Creating secure credentials folder..."

mkdir -p ~/.credentials/reports-grand
chmod 700 ~/.credentials
chmod 700 ~/.credentials/reports-grand

echo "✓ Credentials folder ready at: ~/.credentials/reports-grand"
echo ""
echo "  ⚠️  Ask Darjan to send you 6 token files via Signal."
echo "  Put them in: ~/.credentials/reports-grand/"
echo "  (ga4_key.json, ga4_token.json, oauth_client.json,"
echo "   mailchimp_token.json, meta_token.json, pages_token.json)"

# ── 6. Set up automatic daily sync and end-of-day reminder ────────────────
echo ""
echo "Setting up automatic reminders..."

AUTOMATION_DIR="$PROJECTS_DIR/.git-automation"
mkdir -p "$AUTOMATION_DIR"

# auto-pull script — runs every morning at 09:00
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

# reminder script — runs every day at 17:30
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

# Install launchd agents (macOS scheduler)
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
mkdir -p "$LAUNCH_AGENTS"
HOME_ESCAPED="${HOME//\//\\/}"

sed "s|HOME_PLACEHOLDER|$HOME|g" > "$LAUNCH_AGENTS/mk.zhar.git-auto-pull.plist" << PLIST
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

sed "s|HOME_PLACEHOLDER|$HOME|g" > "$LAUNCH_AGENTS/mk.zhar.git-reminder.plist" << PLIST
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

echo "✓ Auto-pull set up: every morning at 09:00"
echo "✓ Reminder set up: every day at 17:30 if you have unsaved changes"

# ── 6. Done ────────────────────────────────────────────────────────────────
echo ""
echo "======================================"
echo "  All done! Your projects are at:"
echo "  Desktop → CLAUDE PROJECTS"
echo ""
echo "  • Every morning at 09:00 your projects"
echo "    will sync automatically."
echo "  • Every day at 17:30 you'll get a"
echo "    reminder if you forgot to commit."
echo ""
echo "  Read WORKFLOW.md in any project"
echo "  folder to see daily commands."
echo "======================================"
echo ""
