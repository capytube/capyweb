#!/bin/sh
# Offline test of fix.sh and back.sh against a fake aws (a folder bucket that keeps each object's headers) and a fake
# curl, on a temp copy of the package: refusals without the GO, stops on a changed live file or a bad package file (nothing uploaded), the result
# (build + the live-only keys), headers, upload order, a rerun, and back.sh restoring today's bytes exactly.
#   sh test.sh <package folder from pack.sh> <live copy> <redesign build>
set -u
LIVE=$(cd "$2" && pwd) NEW=$(cd "$3" && pwd); W=$(mktemp -d); trap 'rm -rf "$W"' EXIT; F=$W/fake
# the test runs a temp copy of the package (it corrupts a file there on purpose), so the package stays byte-clean
cp -R "$1" $W/pkg; PK=$W/pkg
mkdir -p $F/bin $F/bucket $F/meta && cp -R "$LIVE/." $F/bucket/
(cd $F/bucket && find . -type f | sed 's|^\./||') | while read -r k; do mkdir -p "$F/meta/$(dirname "$k")"
  ct=$(grep "^$k|" "$PK/list.txt" | cut -d'|' -f4); [ -n "$ct" ] || ct=unknown/live
  cc=public,max-age=301   # distinct from what fix.sh sets on an added key, so a kept header shows
  printf '%s\n%s\n' "$ct" "$cc" > "$F/meta/$k"; done
cat > $F/bin/aws <<A
#!/bin/sh
F=$F
echo "aws \$*" >> \$F/calls.log
case "\$*" in *describe-stack-resource*) echo capyapp-capycoffee-roast-stub; exit 0;; *create-invalidation*) echo IFAKE; exit 0;; *"cloudfront wait"*) exit 0;; esac
key=; ct=; cc=; q=; src=; dst=; prev=
for a in "\$@"; do
  case \$prev in --key) key=\$a;; --content-type) ct=\$a;; --cache-control) cc=\$a;; --query) q=\$a;; esac
  case \$a in s3://*) k=\${a#s3://*/}; if [ -z "\$src" ]; then src=s3:\$k; else dst=s3:\$k; fi;; /*) if [ "\$prev" != --key ] && [ "\$prev" != --content-type ]; then if [ -z "\$src" ]; then src=\$a; else dst=\$a; fi; fi;; esac
  prev=\$a
done
case "\$*" in
  *head-object*) [ -f "\$F/bucket/\$key" ] || { echo "An error occurred (404)" >&2; exit 254; }
    case \$q in ContentType) sed -n 1p "\$F/meta/\$key";; CacheControl) sed -n 2p "\$F/meta/\$key";; *) echo '{}';; esac;;
  *"s3 cp"*) case \$src in s3:*) cp "\$F/bucket/\${src#s3:}" "\$dst";; *) k=\${dst#s3:}; mkdir -p "\$F/bucket/\$(dirname "\$k")" "\$F/meta/\$(dirname "\$k")"; cp "\$src" "\$F/bucket/\$k"; printf '%s\n%s\n' "\$ct" "\$cc" > "\$F/meta/\$k";; esac;;
  *"s3 rm"*) rm -f "\$F/bucket/\${src#s3:}" "\$F/meta/\${src#s3:}";;
  *) echo "fake aws: unknown \$*" >&2; exit 9;;
esac
A
printf '#!/bin/sh\nfor a in "$@"; do case $a in https://roast.capy.life/*) cat "%s/bucket/${a#https://roast.capy.life/}" 2>/dev/null;; esac; done\n' "$F" > $F/bin/curl
chmod +x $F/bin/*; PATH=$F/bin:$PATH; export PATH
snap() { (cd $F/bucket && find . -type f | LC_ALL=C sort | xargs shasum -a 256); }
meta() { tr '\n' '|' < "$F/meta/$1"; }
ok=0 no=0; t() { if [ "$1" = 0 ]; then ok=$((ok+1)); echo "ok   $2"; else no=$((no+1)); echo "FAIL $2"; fi; }
sh $PK/fix.sh >/dev/null 2>&1; [ $? = 2 ]; t $? "fix.sh refuses without CAPY_ROAST_GO=1"
sh $PK/back.sh >/dev/null 2>&1; [ $? = 2 ]; t $? "back.sh refuses without CAPY_ROAST_GO=1"
before=$(snap); k=$(grep -v '|-|' $PK/list.txt | head -1 | cut -d'|' -f1)
cp "$F/bucket/$k" $W/save; echo x >> "$F/bucket/$k"; b2=$(snap)
CAPY_ROAST_GO=1 sh $PK/fix.sh >$W/o 2>&1; r=$?; [ $r = 1 ] && [ "$(snap)" = "$b2" ] && grep -q 'not today' $W/o; t $? "fix.sh stops on a changed live file ($k), nothing uploaded"
cp $W/save "$F/bucket/$k"
cp "$PK/new/$k" $W/save; echo x >> "$PK/new/$k"
CAPY_ROAST_GO=1 sh $PK/fix.sh >$W/o 2>&1; r=$?; cp $W/save "$PK/new/$k"; [ $r = 1 ] && [ "$(snap)" = "$before" ] && grep -q "new/$k has the wrong" $W/o; t $? "fix.sh stops on a bad package file, nothing uploaded"
: > $F/calls.log; CAPY_ROAST_GO=1 sh $PK/fix.sh >$W/o 2>&1; t $? "fix.sh exit 0: $(tail -1 $W/o | cut -c1-60)"
want=$( (cd "$NEW" && find . -type f ! -name '._*' | LC_ALL=C sort | xargs shasum -a 256; cd "$LIVE" && find . -type f | LC_ALL=C sort | while read -r f; do [ -f "$NEW/$f" ] || shasum -a 256 "$f"; done) | LC_ALL=C sort -k2)
[ "$(snap | LC_ALL=C sort -k2)" = "$want" ]; t $? "bucket = redesign build + the live-only keys kept"
bad=0; while IFS='|' read -r key old new ct cc; do
  if [ "$old" = - ]; then [ "$(meta "$key")" = "$ct|$cc|" ] || bad=1; else [ "$(meta "$key")" = "$ct|public,max-age=301|" ] || bad=1; fi
done < $PK/list.txt; t $bad "headers: added keys as infra/upload.sh, changed keys keep their own"
la=$(grep '|-|' $PK/list.txt | cut -d'|' -f1 | while read -r a; do grep -n "s3 cp .*/new/$a " $F/calls.log | cut -d: -f1; done | sort -n | tail -1)
fc=$(grep -v '|-|' $PK/list.txt | cut -d'|' -f1 | while read -r a; do grep -n "s3 cp .*/new/$a " $F/calls.log | cut -d: -f1; done | sort -n | head -1)
[ "$la" -lt "$fc" ]; t $? "every added key is uploaded before the first changed key"
grep -q 'create-invalidation.*--paths /\*' $F/calls.log; t $? "invalidates /*"
n=$(wc -l < $PK/list.txt | tr -d ' ')
CAPY_ROAST_GO=1 sh $PK/fix.sh >$W/o 2>&1; r=$?; [ $r = 0 ] && grep -q "$n keys already have the new bytes" $W/o; t $? "rerun of fix.sh: all $n already new, exit 0"
CAPY_ROAST_GO=1 sh $PK/back.sh >$W/o 2>&1; r=$?; [ $r = 0 ] && [ "$(snap)" = "$before" ]; t $? "back.sh: bucket = today's live bytes exactly"
bad=0; while IFS='|' read -r key old new ct cc; do [ "$old" = - ] && continue; [ "$(meta "$key")" = "$ct|public,max-age=301|" ] || bad=1; done < $PK/list.txt; t $bad "back.sh keeps the headers"
echo "$ok ok, $no failed"; [ $no = 0 ]
