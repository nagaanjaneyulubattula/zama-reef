#!/usr/bin/env bash
# Removes backend/.env from entire git history so GitHub push protection passes.
# Run from repo root in Git Bash: bash scripts/purge-git-secrets.sh

set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Stopping if .env is currently tracked..."
git rm --cached -f backend/.env 2>/dev/null || true

echo "==> Rewriting history to remove backend/.env from all commits..."
if command -v git-filter-repo >/dev/null 2>&1; then
  git filter-repo --path backend/.env --invert-paths --force
else
  git filter-branch --force --index-filter \
    "git rm --cached --ignore-unmatch backend/.env" \
    --prune-empty --tag-name-filter cat -- --all
  rm -rf .git/refs/original/
fi

echo "==> Cleaning reflog and garbage-collecting..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "Done. backend/.env is removed from git history."
echo "Next steps:"
echo "  1. Rotate your Supabase SECRET key in the dashboard (old key was exposed)."
echo "  2. Keep real keys only in backend/.env (never committed)."
echo "  3. git push -u origin main --force"
echo ""
echo "Verify: git log --all -- backend/.env   (should show nothing)"
