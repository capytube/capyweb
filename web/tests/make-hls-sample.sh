#!/bin/bash
# Makes the local video fixtures for the player (W6, docs/VIDEO_DESIGN.md "Player contract"):
#
#   web/fixtures/live/<id>/index.m3u8 + init.mp4 + seg*.m4s   one per PUBLIC camera in streams.json
#   web/fixtures/media/<fallback_reel>                         the reel those cameras name
#
# The output is committed, so the checks and the smoke test need no ffmpeg. Re-run this only
# when the fixture cameras change:  web/tests/make-hls-sample.sh   (needs ffmpeg and node)
#
# Synthetic test patterns, not camera footage: a few seconds each, 320x180 at 15 fps, video only.
#
# Codec: VP9, in fMP4 segments for HLS and in an MP4 file for the reel. The smoke test runs in
# Playwright's Chromium headless shell, which is built without the patent-encumbered codecs
# (H.264, AAC), so an H.264 sample would not decode there. VP9 in fMP4 plays through hls.js
# (Media Source Extensions) in every current browser. The real cameras will send H.264; that is
# the encoder's business (docs/VIDEO_DESIGN.md), not the player's.
#
# The live playlists have no #EXT-X-ENDLIST, so the player treats them as live, as it will a
# real camera's rolling playlist: it starts near the live edge and keeps reloading the playlist.
set -euo pipefail
cd "$(dirname "$0")/.."   # web/

command -v ffmpeg >/dev/null || { echo "make-hls-sample: needs ffmpeg (brew install ffmpeg)" >&2; exit 1; }
command -v node >/dev/null || { echo "make-hls-sample: needs node" >&2; exit 1; }

SECONDS_LIVE=16     # 8 segments of 2 s
SECONDS_REEL=12
SIZE=320x180
FPS=15
# One keyframe per 2 s segment. crf 50 with no bitrate target keeps a test pattern tiny.
VP9=(-c:v libvpx-vp9 -b:v 0 -crf 50 -deadline good -cpu-used 5 -row-mt 1
     -g $((FPS * 2)) -keyint_min $((FPS * 2)) -pix_fmt yuv420p -an)

# The ids and the reel come from the fixtures, so the sample cannot drift from the cameras.
# Ids are checked against the API's id rule (web/src/api.rs validate_id) before any path is built.
read -r -a public_ids <<<"$(node -e '
  const s = require("./fixtures/streams.json").items.filter(s => s.access_type === "public");
  const ok = s.every(x => /^[A-Za-z0-9_-]{1,128}$/.test(x.id));
  if (!ok) { console.error("unexpected stream id"); process.exit(1); }
  console.log(s.map(x => x.id).join(" "));')"
reel=$(node -e '
  const r = [...new Set(require("./fixtures/streams.json").items.map(s => s.fallback_reel).filter(Boolean))];
  if (r.length !== 1 || !/^[A-Za-z0-9_-][A-Za-z0-9._-]*\.mp4$/.test(r[0])) { console.error("expected one .mp4 reel, got " + r); process.exit(1); }
  console.log(r[0]);')

hue=0
for id in "${public_ids[@]}"; do
  out="fixtures/live/$id"
  rm -rf "$out" && mkdir -p "$out"
  # A different hue per camera, so a screenshot shows which stream is playing.
  ffmpeg -hide_banner -loglevel error -f lavfi -i "testsrc=size=$SIZE:rate=$FPS:duration=$SECONDS_LIVE" \
    -vf "hue=h=$hue" "${VP9[@]}" \
    -f hls -hls_time 2 -hls_list_size 0 -hls_segment_type fmp4 \
    -hls_fmp4_init_filename init.mp4 -hls_segment_filename "$out/seg%03d.m4s" \
    -hls_flags omit_endlist+independent_segments "$out/index.m3u8"
  hue=$((hue + 120))
done

mkdir -p fixtures/media
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=$SIZE:rate=$FPS:duration=$SECONDS_REEL" \
  "${VP9[@]}" -movflags +faststart "fixtures/media/$reel"

du -ch fixtures/live "fixtures/media/$reel" | tail -1 | sed 's/total/total written/'
