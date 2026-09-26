#!/bin/bash
# Install the local git hooks. Run once per clone:  scripts/install-hooks.sh
#
# There is no CI to fall back on - nic's GitHub Actions allowance is exhausted - so these
# hooks are the only automated gate before a push.
#
# Honours core.hooksPath, which beads sets to .beads/hooks in this repo (.git/hooks would
# never run). Beads manages its own block between "BEGIN/END BEADS INTEGRATION" markers and
# leaves everything outside them alone, so our block is APPENDED after beads' rather than
# replacing the file. Re-running is safe: an existing capyweb block is replaced in place.
set -euo pipefail
cd "$(dirname "$0")/.."

HOOKS=$(git rev-parse --git-path hooks)
mkdir -p "$HOOKS"
BEGIN="# --- BEGIN CAPYWEB GUARD ---"
END="# --- END CAPYWEB GUARD ---"

[ -n "$(git config --get core.hooksPath || true)" ] &&
  echo "note: core.hooksPath is set, installing into $HOOKS"

# $1 = hook name, $2 = commands to run
install_hook() {
  local name="$1" body="$2" path="$HOOKS/$1"

  if [ ! -f "$path" ]; then
    printf '#!/usr/bin/env sh\n' > "$path"
  elif grep -qF "$BEGIN" "$path"; then
    # Replace our previous block, leaving anyone else's content untouched.
    awk -v b="$BEGIN" -v e="$END" '
      $0 == b { skip = 1 } skip && $0 == e { skip = 0; next } !skip
    ' "$path" > "$path.tmp" && mv "$path.tmp" "$path"
  fi

  {
    echo "$BEGIN"
    echo '# capyweb cost/security guards. Bypass one commit with --no-verify, and say why.'
    echo 'capyweb_root="$(git rev-parse --show-toplevel)"'
    echo "$body"
    echo "$END"
  } >> "$path"
  chmod +x "$path"
  echo "installed $name"
}

install_hook pre-commit '"$capyweb_root/scripts/guard.sh" --quiet || exit 1'

install_hook pre-push '"$capyweb_root/scripts/guard.sh" --quiet || exit 1
# guard.sh only sees the working tree. This catches a secret that was committed and then
# deleted - which is how all eight secrets already in this history got there. ~1s.
"$capyweb_root/scripts/scan-history.py" --known-ok >/dev/null 2>&1 || {
  echo "a secret not recorded in scripts/history-secrets-known.txt is in the history:"
  "$capyweb_root/scripts/scan-history.py" --known-ok 2>&1 | grep "\[NEW" || true
  exit 1
}
if [ -d "$capyweb_root/backend/src/node_modules" ]; then
  ( cd "$capyweb_root/backend/src" && npm test --silent ) || { echo "backend tests failed"; exit 1; }
else
  echo "note: backend/src/node_modules missing, skipping tests (npm install there to enable)"
fi
# The frontend client tests need no dependencies - they stub fetch and run on plain Node.
node --test --experimental-strip-types "$capyweb_root/src/api/" >/dev/null 2>&1 || {
  echo "frontend api tests failed"; exit 1; }'

echo
echo "Hooks live in $HOOKS, appended after any beads block. Verify: scripts/guard-selftest.sh"
