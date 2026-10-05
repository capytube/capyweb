#!/bin/zsh
# Make a patched copy of the static export: append patches/*.css to its stylesheet, give the
# stylesheet a new content-hashed name (the old one is cached as immutable for a year), and point
# every page and RSC payload at the new name. Deterministic: same inputs, same output.
#   patch-build.sh <base build> <out dir>
set -eu
BASE=$1; OUT=$2; HERE=${0:A:h}
[ ! -e "$OUT" ] || { echo "patch-build.sh: $OUT exists" >&2; exit 1; }
cp -R "$BASE" "$OUT"
css=($OUT/_next/static/chunks/*.css)
[ ${#css} -eq 1 ] || { echo "patch-build.sh: expected one stylesheet, found ${#css}" >&2; exit 1; }
old=${css[1]:t}
cat $HERE/patches/*.css >> ${css[1]}
new=${old:r}-$(shasum -a 256 ${css[1]} | cut -c1-10).css
mv ${css[1]} ${css[1]:h}/$new
files=($(grep -rlF "$old" $OUT --include='*.html' --include='*.txt'))
for f in $files; do LC_ALL=C sed -i '' "s/${old//./\\.}/$new/g" $f; done
left=$(grep -rlF "$old" $OUT | wc -l | tr -d ' ')
[ "$left" = 0 ] || { echo "patch-build.sh: $left files still name $old" >&2; exit 1; }
echo "patched $old -> $new in ${#files} files"
