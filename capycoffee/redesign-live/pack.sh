#!/bin/sh
# Makes the go-live folder for the Capy Roast redesign (p221): compares today's live bucket (a full copy) with the
# redesign build and writes <out>/list.txt plus new/ (the build's bytes for every changed or added key) and old/ (the
# live bytes of every changed key), next to fix.sh and back.sh. Keys only on live (the old stylesheet and JS chunk) are
# left alone, so a page cached before the switch still finds them. The folder needs no git: copy it anywhere.
#   sh pack.sh <live copy> <redesign build> <out>
set -eu
LIVE=$1 NEW=$2 OUT=$3 H=$(cd "$(dirname "$0")" && pwd)
[ ! -e "$OUT" ] || { echo "pack.sh: $OUT exists" >&2; exit 1; }
mkdir -p "$OUT/new" "$OUT/old"; cp "$H/fix.sh" "$H/back.sh" "$OUT/"
# list.txt: key|live sha256 (- when added)|new sha256|Content-Type|Cache-Control (the headers infra/upload.sh sets)
(cd "$NEW" && find . -type f ! -name '._*' | sed 's|^\./||' | LC_ALL=C sort) | while read -r key; do
  new=$(shasum -a 256 "$NEW/$key" | cut -d' ' -f1)
  if [ -f "$LIVE/$key" ]; then old=$(shasum -a 256 "$LIVE/$key" | cut -d' ' -f1); [ "$old" != "$new" ] || continue
    mkdir -p "$OUT/old/$(dirname "$key")"; cp "$LIVE/$key" "$OUT/old/$key"; else old=-; fi
  case $key in *.html) ct='text/html; charset=utf-8';; *.js) ct='text/javascript; charset=utf-8';; *.css) ct='text/css; charset=utf-8';;
    *.txt) ct='text/plain; charset=utf-8';; *.webp) ct=image/webp;; *.svg) ct=image/svg+xml;; *.ico) ct=image/x-icon;; *.woff2) ct=font/woff2;;
    *) echo "pack.sh: no Content-Type for $key" >&2; exit 1;; esac
  case $key in _next/static/*) cc='public,max-age=31536000,immutable';; *) cc='public,max-age=300';; esac
  mkdir -p "$OUT/new/$(dirname "$key")"; cp "$NEW/$key" "$OUT/new/$key"
  echo "$key|$old|$new|$ct|$cc"
done > "$OUT/list.txt"
echo "pack.sh: $(grep -c '|-|' "$OUT/list.txt") added, $(grep -vc '|-|' "$OUT/list.txt") changed -> $OUT"
