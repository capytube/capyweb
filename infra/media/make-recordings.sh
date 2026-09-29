#!/bin/bash
# Cut CapyTube's own recording into one HLS video-on-demand stream per camera (W6, recorded
# mode: nic, 2026-09-29, "mock it up with a playback for now"). docs/VIDEO_DESIGN.md section 8.
#
# Usage: infra/media/make-recordings.sh <source.mp4> <out-dir>
#   <source.mp4>  capytube-stream.mp4, the file the current site and demo/ already play
#                 (the one video behind the 7 baselined S3 URLs, capyweb-c24). Nothing else.
#   <out-dir>     receives the bucket layout: media/rec/<camera>/..., paid/<camera>/...,
#                 media/capytube-stream.mp4. Upload it with infra/media/upload-media.sh.
#
# What it does to the picture:
#   - covers the "Live stream" label burned into the source's frame with "Recorded"
#     (recorded-label.png, 168x36 at 556,5 of the 1280x720 source). On the camera angle that
#     has no frame it shows as a small badge at the top.
#   - drops the audio: it is digital silence (-91 dB mean and peak, measured with volumedetect).
#   - two renditions, H.264 through VideoToolbox (the Mac's media engine, so the CPU stays free):
#     720p at up to 2.4 Mbit/s and 360p at up to 0.7 Mbit/s. A keyframe every 2 s, 6 s fMP4
#     segments, VOD playlists (#EXT-X-ENDLIST) and a master playlist index.m3u8.
set -euo pipefail
SRC=${1:?source mp4}
OUT=${2:?out dir}
LABEL=$(cd "$(dirname "$0")" && pwd)/recorded-label.png
[ -f "$SRC" ] && [ -f "$LABEL" ]

# camera   key prefix   start (s)  length (s). The source is 4,654 s long; each camera gets
# its own third, so no two cameras show the same minute. wall-cam is the paid camera: its files
# go under paid/, which CloudFront serves only with signed cookies.
CAMS=(
  "main-cam media/rec 0    1551"
  "food-cam media/rec 1551 1551"
  "wall-cam paid      3102 1552"
)

hls() { # hls <start> <length> <dir>
  mkdir -p "$3"
  (cd "$3" && ffmpeg -hide_banner -loglevel warning -nostdin -y -threads 2 \
    -ss "$1" -t "$2" -i "$SRC" -i "$LABEL" \
    -filter_complex "[0:v][1:v]overlay=556:5,split=2[hi][lo0];[lo0]scale=640:360[lo]" \
    -map "[hi]" -map "[lo]" -an \
    -c:v h264_videotoolbox -allow_sw 0 -realtime 0 \
    -b:v:0 2400k -maxrate:v:0 3000k -bufsize:v:0 4800k -profile:v:0 high \
    -b:v:1 700k -maxrate:v:1 900k -bufsize:v:1 1400k -profile:v:1 main \
    -force_key_frames "expr:gte(t,n_forced*2)" -g 60 \
    -f hls -hls_time 6 -hls_playlist_type vod -hls_segment_type fmp4 -hls_flags independent_segments \
    -hls_fmp4_init_filename init.mp4 -hls_segment_filename "%v/seg%04d.m4s" \
    -master_pl_name index.m3u8 -var_stream_map "v:0,name:720p v:1,name:360p" "%v/index.m3u8")
}

for c in "${CAMS[@]}"; do
  read -r id prefix start len <<<"$c"
  echo "$id: $prefix/$id from ${start}s for ${len}s"
  rm -rf "${OUT:?}/$prefix/$id"
  hls "$start" "$len" "$OUT/$prefix/$id"
done

# The reel: what a public camera's player falls back to if its playlist fails. One minute of
# the main camera's third, 720p, progressive MP4 with the index at the front.
mkdir -p "$OUT/media"
ffmpeg -hide_banner -loglevel warning -nostdin -y -threads 2 -ss 600 -t 60 -i "$SRC" -i "$LABEL" \
  -filter_complex "[0:v][1:v]overlay=556:5" -an -c:v h264_videotoolbox -allow_sw 0 -realtime 0 \
  -b:v 2000k -maxrate 2500k -bufsize 4000k -profile:v high -g 60 -movflags +faststart \
  "$OUT/media/capytube-stream.mp4"

du -sh "$OUT"/media/rec/* "$OUT"/paid/* "$OUT/media/capytube-stream.mp4"
