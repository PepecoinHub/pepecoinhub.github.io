#!/usr/bin/env bash
# Mechanical export of generated art only; not a change to the live game.
# Usage: bash export-frames.sh idle.png feed-sheet.png clean-sheet.png play-sheet.png rest-sheet.png
set -euo pipefail
[[ $# == 5 ]] || { echo 'Expected idle and four 2x2 animation sheets' >&2; exit 2; }
out="$(cd "$(dirname "$0")" && pwd)/frames"
mkdir -p "$out"
tmp=$(mktemp -d)
trap 'rm -f "$tmp/cell.png" "$tmp/trim.png"; rmdir "$tmp"' EXIT

export_frame() {
  local input=$1 name=$2 box foot fw fh fx fy x
  box=$(magick "$input" -alpha extract -threshold 30% -format '%@' info:)
  [[ $box =~ ^[0-9]+x[0-9]+\+[0-9]+\+[0-9]+$ ]] || return 1
  # Froglet: existing visible height is 94 logical pixels, feet at logical y=124.
  # Preserve canvas and foot center at double resolution; no re-positioning of room objects.
  magick "$input" -crop "$box" +repage -filter point -resize x188 "$tmp/trim.png"
  foot=$(magick "$tmp/trim.png" -alpha extract -threshold 30% -gravity South -crop x36+0+0 +repage -format '%@' info:)
  [[ $foot =~ ^([0-9]+)x([0-9]+)\+([0-9]+)\+([0-9]+)$ ]] || return 1
  fw=${BASH_REMATCH[1]}; fh=${BASH_REMATCH[2]}; fx=${BASH_REMATCH[3]}; fy=${BASH_REMATCH[4]}
  x=$((128 - fx - fw / 2))
  [[ $x -ge 0 && $((x + $(magick identify -format '%w' "$tmp/trim.png"))) -le 256 ]] || return 1
  magick -size 256x256 canvas:none "$tmp/trim.png" -geometry "+${x}+60" -compose over -composite -strip PNG32:"$out/$name.png"
}

export_frame "$1" pepegochi_froglet_idle
shift
for action in feed clean play rest; do
  sheet=$1; shift
  read -r width height < <(magick identify -format '%w %h\n' "$sheet")
  [[ $((width % 2)) == 0 && $((height % 2)) == 0 ]] || exit 1
  w=$((width / 2)); h=$((height / 2))
  for n in 0 1 2 3; do
    magick "$sheet" -crop "${w}x${h}+$((n % 2 * w))+$((n / 2 * h))" +repage "$tmp/cell.png"
    export_frame "$tmp/cell.png" "care_froglet_${action}_0$((n + 1))"
  done
done
