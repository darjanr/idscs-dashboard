# Daily workflow — plain and simple

Open **Terminal**, go to your project folder, and use the commands below.

---

## Go to this project

```
cd ~/Desktop/CLAUDE\ PROJECTS/idscs-dashboard
```

---

## Before you start working — always do this first

This downloads the latest version from GitHub (in case Darjan made changes).

```
git pull
```

---

## After you make changes — save and upload

Do these three commands in order:

**1. Mark which files you changed:**
```
git add .
```

**2. Save a snapshot with a short note about what you did:**
```
git commit -m "what I changed — short description"
```
> Example: `git commit -m "update MP profile text for Albanian"`

**3. Upload to GitHub:**
```
git push
```

---

## Check what's going on

**See what files you've changed (haven't saved yet):**
```
git status
```

**See the full history of changes and who made them:**
```
cat CHANGELOG.md
```

---

## Working at the same time as Darjan

If you're both working at the same time, start your own version of the file with a branch.

**Start a new branch (your own safe copy):**
```
git checkout -b iva/what-im-working-on
```
> Example: `git checkout -b iva/fix-albanian-translations`

**Push your branch to GitHub:**
```
git push origin iva/what-im-working-on
```

Then tell Darjan — he'll review it and merge it in.

---

## Something went wrong?

Nothing is ever lost — every saved version is in git history. Just tell Darjan what happened and he can restore any previous version.
