#!/usr/bin/env bash
# Usage: bash export-stages.sh tadpole.png adult.png hatch-sheet.png
set -euo pipefail
[[ $# == 3 ]] || { echo 'Expected tadpole, adult and four-cell hatch sheet' >&2; exit 2; }
out="$(cd "$(dirname "$0")" && pwd)/frames"
mkdir -p "$out"
tmp=$(mktemp -d)
trap 'rm -f "$tmp/cell.png" "$tmp/trim.png"; rmdir "$tmp"' EXIT

export_frame() {
  local input=$1 name=$2 top=$3 center=$4 box width x height
  box=$(magick "$input" -alpha extract -threshold 30% -format '%@' info:)
  [[ $box =~ ^[0-9]+x[0-9]+\+[0-9]+\+[0-9]+$ ]] || return 1
  height=$((248 - top))
  magick "$input" -crop "$box" +repage -filter point -resize "x$height" "$tmp/trim.png"
  width=$(magick identify -format '%w' "$tmp/trim.png")
  x=$((center - width / 2))
  if (( x < 0 )); then x=0; fi
  if (( x + width > 256 )); then x=$((256 - width)); fi
  [[ $x -ge 0 ]] || return 1
  magick -size 256x256 canvas:none "$tmp/trim.png" -geometry "+${x}+${top}" -compose over -composite -strip PNG32:"$out/$name.png"
}

export_frame "$1" pepegochi_tadpole_idle 100 127
export_frame "$2" pepegochi_adult_idle 18 127
sheet=$3
read -r width height < <(magick identify -format '%w %h\n' "$sheet")
tops=(84 84 40 100)
centers=(125 124 136 123)
for n in 0 1 2 3; do
  x=$((n % 2 * (width / 2))); y=$((n / 2 * (height / 2)))
  w=$((width / 2 + n % 2 * (width % 2))); h=$((height / 2 + n / 2 * (height % 2)))
  magick "$sheet" -crop "${w}x${h}+${x}+${y}" +repage "$tmp/cell.png"
  export_frame "$tmp/cell.png" "pepegochi_hatch_0$((n + 1))" "${tops[n]}" "${centers[n]}"
done
cp "$out/pepegochi_hatch_01.png" "$out/pepegochi_egg_idle.png"
