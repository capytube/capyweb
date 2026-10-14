#!/bin/zsh
# Capy Roast redesign (nic order #4097) over a renamed build, in place: appends redesign/roast.css to the stylesheet
# (new content-hashed name, as patch-build.sh does), adds the family morph gallery (redesign/morph.js + hero.js) and
# the pictures under /roast-family/, and changes the home headline. The order form, prices and checkout are untouched.
# Deterministic: same inputs, same output.
#   redesign-roast.sh <build dir> <pictures dir>   (the pictures dir holds <name>.webp and <name>-768.webp per line of
#   redesign/pictures.txt: "name|alt"; the first line is the hero, the 2nd the About band, the 3rd the Roast band)
set -eu
setopt null_glob extended_glob
OUT=$1; PICS=$2; HERE=${0:A:h}; R=$HERE/redesign
[ -d "$OUT/_next/static/chunks" ] || { echo "redesign-roast.sh: $OUT is not a build" >&2; exit 1; }
[ ! -e "$OUT/roast-family" ] || { echo "redesign-roast.sh: $OUT already has the redesign" >&2; exit 1; }
! grep -rqF Capycoffee "$OUT" || { echo "redesign-roast.sh: run rename-roast.sh first" >&2; exit 1; }

# pictures
names=(); js='['
while IFS='|' read -r name alt; do
  [ -n "$name" ] || continue
  [[ $name == [a-z0-9-]## ]] || { echo "redesign-roast.sh: bad picture name '$name'" >&2; exit 1; }
  for v in $name.webp $name-768.webp; do [ -f "$PICS/$v" ] || { echo "redesign-roast.sh: missing $PICS/$v" >&2; exit 1; }; done
  names+=($name); js+="$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1:]))' "$name" "$alt"),"
done < "$R/pictures.txt"
[ ${#names} -ge 3 ] || { echo "redesign-roast.sh: pictures.txt needs at least 3 pictures" >&2; exit 1; }
js="${js%,}]"
mkdir "$OUT/roast-family"
for n in $names; do cp "$PICS/$n.webp" "$PICS/$n-768.webp" "$OUT/roast-family/"; done
cp "$R/morph.js" "$OUT/roast-family/morph.js"
python3 - "$R/hero.js" "$OUT/roast-family/hero.js" "$js" <<'EOF'
import sys
s = open(sys.argv[1]).read(); assert s.count('/*PICS*/[]') == 1
open(sys.argv[2], 'w').write(s.replace('/*PICS*/[]', sys.argv[3]))
EOF

# stylesheet
css=("$OUT"/_next/static/chunks/*.css)
[ ${#css} -eq 1 ] || { echo "redesign-roast.sh: expected one stylesheet, found ${#css}" >&2; exit 1; }
old=${css[1]:t}
sed -e "s/__P0__/${names[1]}/g" -e "s/__P1__/${names[2]}/g" -e "s/__P2__/${names[3]}/g" "$R/roast.css" >> "${css[1]}"
new=${old%%-*}; new=${new%.css}-$(shasum -a 256 "${css[1]}" | cut -c1-10).css
mv "${css[1]}" "${css[1]:h}/$new"
for f in $(grep -rlF "$old" "$OUT" --include='*.html' --include='*.txt'); do LC_ALL=C sed -i '' "s/${old//./\\.}/$new/g" "$f"; done
[ "$(grep -rlF "$old" "$OUT" | wc -l | tr -d ' ')" = 0 ] || { echo "redesign-roast.sh: files still name $old" >&2; exit 1; }

# scripts on every page (in-site navigation can reach the home page from any of them); hero picture preload on home
tags='<script src="/roast-family/morph.js" defer></script><script src="/roast-family/hero.js" defer></script>'
pages=($(find "$OUT" -name '*.html' | sort))
for f in $pages; do
  [ "$(grep -c '</head>' "$f")" = 1 ] || { echo "redesign-roast.sh: $f has no single </head>" >&2; exit 1; }
  LC_ALL=C sed -i '' "s#</head>#$tags</head>#" "$f"
done
pre="<link rel=\"preload\" as=\"image\" href=\"/roast-family/${names[1]}-768.webp\" imagesrcset=\"/roast-family/${names[1]}-768.webp 768w, /roast-family/${names[1]}.webp 1536w\" imagesizes=\"100vw\" fetchpriority=\"high\"/>"
LC_ALL=C sed -i '' "s#</head>#$pre</head>#" "$OUT/index.html"

# home headline: "Freebird rotating bean." becomes "Freebird, roasted to order." (the site's own title line) in the
# page, its inline RSC rows and the .txt payloads, so the server HTML and the client render agree
hl=($(grep -rlF ' rotating bean.' "$OUT" --include='*.html' --include='*.txt'))
for f in $hl; do LC_ALL=C sed -i '' -e 's#<!-- --> rotating bean\.</h1>#<!-- -->, roasted to order.</h1>#' \
  -e 's#" rotating bean\."\]#", roasted to order."]#g' -e 's#\\" rotating bean\.\\"\]#\\", roasted to order.\\"]#g' "$f"; done
left=$(grep -rlF ' rotating bean.' "$OUT" | wc -l | tr -d ' ')
[ "$left" = 0 ] || { echo "redesign-roast.sh: $left files still have the old headline" >&2; exit 1; }
echo "redesign: stylesheet $old -> $new; ${#names} pictures; scripts on ${#pages} pages; headline in ${#hl} files"
