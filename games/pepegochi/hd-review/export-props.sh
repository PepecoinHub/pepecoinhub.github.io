#!/usr/bin/env bash
# Export a generated prop without altering its existing room slot or logical baseline.
set -euo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
original="$here/../../../docs/games/img/pepegochi"
scratch=$(mktemp -d)
trap 'rm -f -- "$scratch/crop.png"; rmdir -- "$scratch"' EXIT
id=$1
source=$2
case "$id" in
  crt_tv|lava_lamp|potted_plant|mug|moon_rock|paper_crown|golden_fly|floppy_disk) ;;
  *) printf 'Unknown review prop: %s\n' "$id" >&2; exit 1;;
esac
read -r w h x y < <(magick "$original/$id.png" -alpha extract -threshold 30% -format '%@\n' info: | tr 'x+' ' ')
bbox=$(magick "$source" -alpha extract -threshold 30% -format '%@' info:)
magick "$source" -crop "$bbox" +repage -filter point -resize "$((w*2))x$((h*2))" PNG32:"$scratch/crop.png"
read -r nw nh < <(magick identify -format '%w %h\n' "$scratch/crop.png")
nx=$((x*2+w-nw/2))
ny=$(((y+h)*2-nh))
if [[ "$id" == golden_fly ]]; then ny=$((y*2+h-nh/2)); fi
magick -size 256x256 canvas:none "$scratch/crop.png" -geometry "+$nx+$ny" -compose over -composite -strip PNG32:"$here/room/$id.png"
printf '%s: %sx%s at %s,%s\n' "$id" "$nw" "$nh" "$nx" "$ny"
