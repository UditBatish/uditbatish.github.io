#!/bin/bash
# Home page's first reel card: a short silent loop of clips, cut 4:5 to fit the card.
# Sources are the original iPhone clips in ~/Downloads, plus a few photos from the site itself
# (a "public/..." path), which get a slow push-in so they sit among the clips.
# Run: bash scripts/make_home_highlights.sh
# iPhone clips are HDR (HLG); ffmpeg here can't tone-map, so those go through macOS avconvert
# (its H.264 presets convert to standard colour) first. Skipping that looks oversaturated.
set -e
SRC=~/Downloads
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/home"
mkdir -p "$OUT"
# file | start (s, ignored for photos) | length (s) | horizontal centre of the 4:5 crop (0 = left, 1 = right)
CLIPS=(
"IMG_4149.MOV|0.6|1.6|0.5"      # Bay Bridge at dusk
"IMG_4276.MOV|3.6|1.2|0.42"     # Marin Headlands
"IMG_4295.MOV|0.9|1.3|0.2"      # Golden Gate
"IMG_6265.MOV|0.2|1.1|0.5"      # Pasadena City Hall
"IMG_9133.MOV|2.0|1.3|0.55"     # Dubai Marina at night
"IMG_3191.MOV|1.5|1.0|0.25"     # Bengaluru
"IMG_1726.MOV|3.0|1.1|0.5"      # Gurugram in the rain
"VIDEO-2024-08-11-09-49-10.mp4|3.2|1.8|0.72"   # IIT Delhi convocation, getting the degree
"IMG_1002.MOV|0.0|1.2|0.65"     # morning run at Sukhna Lake, Chandigarh
"IMG_2110 2.MOV|0.3|1.5|0.45"   # Delhi Half Marathon
)
args=(); fc=""; i=0
for c in "${CLIPS[@]}"; do
  IFS='|' read -r f ss t cx <<< "${c%%#*}"; f="${f%"${f##*[![:space:]]}"}"; cx="${cx//[[:space:]]/}"
  CROP="crop='min(iw,ih*4/5)':'min(ih,iw*5/4)':'(iw-min(iw,ih*4/5))*$cx':'(ih-min(ih,iw*5/4))/2'"
  if [[ "$f" == public/* ]]; then
    # a photo: hold it for $t seconds with a slow 6% push-in (scaled up first so it doesn't judder)
    args+=(-loop 1 -framerate 30 -t "$t" -i "$ROOT/$f")
    fc+="[$i:v]$CROP,scale=1440:1800,scale=w='trunc(1440*(1+0.06*t/$t)/2)*2':h=-2:eval=frame,crop=1440:1800,scale=720:900,fps=30,setsar=1[v$i];"
    i=$((i+1)); continue
  fi
  trc=$(ffprobe -v error -select_streams v:0 -show_entries stream=color_transfer -of default=nw=1:nk=1 "$SRC/$f" | head -1)
  if [[ "$trc" == arib-std-b67 || "$trc" == smpte2084 ]]; then
    avconvert -s "$SRC/$f" -p Preset1920x1080 -o "$TMP/$i.mov" --start "$ss" --duration "$(echo "$t + 0.5" | bc)" --replace >/dev/null
    args+=(-t "$t" -i "$TMP/$i.mov")
  else
    args+=(-ss "$ss" -t "$t" -i "$SRC/$f")
  fi
  fc+="[$i:v]fps=30,$CROP,scale=720:900,setsar=1[v$i];"
  i=$((i+1))
done
for ((k=0; k<i; k++)); do fc+="[v$k]"; done
fc+="concat=n=$i:v=1:a=0,format=yuv420p[out]"
ffmpeg -v error -y "${args[@]}" -filter_complex "$fc" -map "[out]" -an -c:v libx264 -preset slow -crf 30 -g 30 -movflags +faststart "$OUT/highlights.mp4"   # small + a keyframe every second, so it starts fast
ffmpeg -v error -y -i "$OUT/highlights.mp4" -frames:v 1 -q:v 4 "$OUT/highlights-poster.jpg"   # the very first frame, so poster → video is seamless
echo "wrote public/home/highlights.mp4 ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/highlights.mp4")s)"
