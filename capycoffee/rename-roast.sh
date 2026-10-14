#!/bin/zsh
# Rename the shown name "Capycoffee" to "Capy Roast" (nic order #4095) in a patched build, in place:
# pages, RSC payloads and the JS chunks. Both names are 10 bytes, so length-prefixed RSC rows stay
# valid. A changed chunk gets a new name of the same length (the old one is cached as immutable for a
# year) and every reference is repointed. Storage keys and ids are lowercase and are not touched.
# Deterministic: same input, same output.   rename-roast.sh <build dir>
set -eu
setopt null_glob
OUT=$1
[ -d "$OUT/_next/static/chunks" ] || { echo "rename-roast.sh: $OUT is not a build" >&2; exit 1; }
js=($(grep -rlF Capycoffee "$OUT/_next/static/chunks" --include='*.js'))
files=($(grep -rlF Capycoffee "$OUT" --include='*.html' --include='*.txt' --include='*.js'))
[ ${#files} -gt 0 ] || { echo "rename-roast.sh: no Capycoffee in $OUT" >&2; exit 1; }
for f in $files; do LC_ALL=C sed -i '' 's/Capycoffee/Capy Roast/g' "$f"; done
for c in $js; do
  old=${c:t:r}
  new=r$(shasum -a 256 "$c" | cut -c1-$(( ${#old} - 1 )))
  mv "$c" "${c:h}/$new.js"
  refs=($(grep -rlF "$old.js" "$OUT" --include='*.html' --include='*.txt' --include='*.js'))
  for f in $refs; do LC_ALL=C sed -i '' "s/${old//-/\\-}\\.js/$new.js/g" "$f"; done
  left=$(grep -rlF "$old.js" "$OUT" | wc -l | tr -d ' ')
  [ "$left" = 0 ] || { echo "rename-roast.sh: $left files still name $old.js" >&2; exit 1; }
  echo "chunk $old.js -> $new.js in ${#refs} files"
done
left=$(grep -rlF Capycoffee "$OUT" | wc -l | tr -d ' ')
[ "$left" = 0 ] || { echo "rename-roast.sh: $left files still say Capycoffee" >&2; exit 1; }
echo "renamed Capycoffee -> Capy Roast in ${#files} files"
