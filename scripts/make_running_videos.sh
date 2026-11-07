#!/bin/bash
# /running/ hero video and the home page Running card, cut from the original
# iPhone clips in ~/Downloads. Run: bash scripts/make_running_videos.sh
# The clips are HDR (HLG); ffmpeg here can't tone-map, so each piece goes through macOS
# avconvert (its H.264 presets convert to standard colour) first. Skipping that, or adding a
# saturation boost, makes them look oversaturated.
set -e
O="$(cd "$(dirname "$0")/.." && pwd)/public/running"; D=~/Downloads
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

# file | start | length | turn (the two sideways clips need a quarter turn)
CLIPS=(
"IMG_2109.MOV|0.5|1.0|"
"IMG_8268.MOV|0.4|1.0|transpose=2,"
"IMG_2109.MOV|3.0|0.9|"
"IMG_2114.MOV|0.0|1.4|transpose=2,"
"IMG_7780.MOV|9.0|1.1|"
"IMG_2110.MOV|0.0|2.4|"
)
i=0
for c in "${CLIPS[@]}"; do
  IFS='|' read -r f ss t turn <<< "$c"
  avconvert -s "$D/$f" -p Preset1920x1080 -o "$TMP/$i.mov" --start "$ss" --duration "$(echo "$t + 0.5" | bc)" --replace >/dev/null
  i=$((i+1))
done

cut() {  # W H name crf
  local W=$1 H=$2 args=() fc="" k=0
  for c in "${CLIPS[@]}"; do
    IFS='|' read -r f ss t turn <<< "$c"
    args+=(-t "$t" -i "$TMP/$k.mov")
    fc+="[$k:v]${turn}scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=30,setsar=1[v$k];"
    k=$((k+1))
  done
  for ((n=0; n<k; n++)); do fc+="[v$n]"; done
  fc+="concat=n=$k:v=1:a=0,format=yuv420p[out]"
  ffmpeg -v error -y "${args[@]}" -filter_complex "$fc" -map "[out]" -an -c:v libx264 -preset slow -crf "$4" -movflags +faststart -map_metadata -1 "$O/$3.mp4"
}
cut 1280 720 highlights 27
cut 432 768 highlights-card 31        # home reel card: small, quick to start
# posters are real video frames (the sunrise road)
ffmpeg -v error -y -ss 3.6 -i "$O/highlights.mp4" -frames:v 1 -q:v 3 "$O/poster.jpg"
ffmpeg -v error -y -ss 3.6 -i "$O/highlights-card.mp4" -frames:v 1 -q:v 4 "$O/poster-card.jpg"
ls -la "$O"/highlights*.mp4 | awk '{print $5, $9}'
