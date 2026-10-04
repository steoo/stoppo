#!/bin/bash
# Renders App Store screenshots into assets/screenshots/ with headless Chrome:
#   iPhone 6.9" → 1320×2868, iPad 13" → 2064×2752.
#   tools/screenshots/make.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT=8767
OUT=assets/screenshots
PROFILE=$(mktemp -d)
mkdir -p "$OUT"

python3 -m http.server "$PORT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER; rm -rf "$PROFILE"' EXIT
sleep 1

# name|level|title|subtitle|extra query
SCENES=(
  "1-home|20|Bring Stoppo home|A calm little transit puzzle|"
  "2-one-stop|22|One stop at a time|Each car rides only its own color|&action=hint"
  "3-puzzles|100|100 puzzles|From 3 moves to 589|"
  "4-progress|39|Track your progress|Score, streaks and perfect runs|&action=progress&seed=progress"
  "5-dark|57|Easy on the eyes|Day or night|&dark=1"
)

urlencode() { python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$1"; }

shoot() { # device css_w css_h scale out_w out_h
  local device=$1 w=$2 h=$3 scale=$4 ow=$5 oh=$6
  for scene in "${SCENES[@]}"; do
    IFS='|' read -r name level title subtitle extra <<<"$scene"
    local url="http://localhost:$PORT/tools/screenshots/frame.html?device=$device&level=$level&title=$(urlencode "$title")&subtitle=$(urlencode "$subtitle")$extra"
    local file="$OUT/$device-$name.png"
    # Headless Chrome windows are at least 500px wide; render wider and crop.
    perl -e 'alarm 25; exec @ARGV' "$CHROME" --headless=new --no-first-run --disable-extensions \
      --user-data-dir="$PROFILE" --hide-scrollbars --force-device-scale-factor="$scale" \
      --window-size="$(( w > 500 ? w : 500 )),$h" --virtual-time-budget=4000 \
      --screenshot="$file" "$url" >/dev/null 2>&1 || true
    sips -c "$oh" "$ow" "$file" >/dev/null # center crop
    # App Store screenshots must not have an alpha channel.
    sips -s format jpeg -s formatOptions 95 "$file" --out "${file%.png}.jpg" >/dev/null && rm "$file"
    echo "$device-$name: $(sips -g pixelWidth -g pixelHeight "${file%.png}.jpg" | awk '/pixel/{printf "%s ", $2}')"
  done
}

shoot iphone 440 956 3 1320 2868
shoot ipad 1032 1376 2 2064 2752
