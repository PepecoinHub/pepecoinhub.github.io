#!/usr/bin/env bash
# Usage: bash export-care.sh {tadpole|adult} feed.png clean.png play.png rest.png
# Mechanical atlas slicing and alignment; no changes to the active room art.
set -euo pipefail
[[ $# == 5 ]] || exit 2
stage=$1; shift
case "$stage" in
  tadpole) prefix=care_tadpole_; body_height=140;;
  adult) prefix=care_; body_height=225;;
  *) exit 2;;
esac
out="$(cd "$(dirname "$0")" && pwd)/frames"
tmp=$(mktemp -d)
trap 'rm -f "$tmp/cell.png" "$tmp/trim.png" "$tmp/mask.png" "$tmp/scaled.png"; rmdir "$tmp"' EXIT

for action in feed clean play rest; do
  sheet=$1; shift
  read -r width height < <(magick identify -format '%w %h\n' "$sheet")
  split=$((width / 2))
  # The generator leaves the gap slightly left of center in these two atlases.
  if [[ $stage == tadpole && $action == feed ]]; then split=$((width * 47 / 100)); fi
  if [[ $stage == tadpole && $action == rest ]]; then split=$((width * 483 / 1000)); fi
  for n in 0 1 2 3; do
    x=$((n % 2 * split)); y=$((n / 2 * (height / 2)))
    w=$((n % 2 == 0 ? split : width-split)); h=$((height / 2 + n / 2 * (height % 2)))
    magick "$sheet" -crop "${w}x${h}+${x}+${y}" +repage "$tmp/cell.png"
    box=$(magick "$tmp/cell.png" -alpha extract -threshold 30% -format '%@' info:)
    [[ $box =~ ^([0-9]+)x([0-9]+)\+([0-9]+)\+([0-9]+)$ ]] || exit 1
    aw=${BASH_REMATCH[1]}; ah=${BASH_REMATCH[2]}
    magick "$tmp/cell.png" -crop "$box" +repage "$tmp/trim.png"
    # Measure green skin, not the floating toy, soap, or sleep symbols.
    magick "$tmp/trim.png" -alpha on -fx 'a>0.3 && g>r*1.12 && g>b*1.15 && g>0.15 ? 1 : 0' -alpha off -colorspace gray -threshold 50% -define connected-components:area-threshold=100 -define connected-components:mean-color=true -connected-components 8 -threshold 50% "$tmp/mask.png"
    body=$(magick "$tmp/mask.png" -format '%@' info:)
    [[ $body =~ ^([0-9]+)x([0-9]+)\+([0-9]+)\+([0-9]+)$ ]] || exit 1
    bw=${BASH_REMATCH[1]}; bh=${BASH_REMATCH[2]}; bx=${BASH_REMATCH[3]}
    # Preserve target character height unless effects would be clipped at the edges.
    read -r sw sh center < <(awk -v w="$aw" -v h="$ah" -v b="$bh" -v t="$body_height" -v c="$((2*bx+bw))" 'BEGIN {s=t/b; if(w*s>252)s=252/w; if(h*s>246)s=246/h; printf "%d %d %d\n",int(w*s+0.5),int(h*s+0.5),int(c*s/2+0.5)}')
    x=$((127-center)); y=$((248-sh))
    if ((x<0)); then x=0; fi
    if ((x+sw>256)); then x=$((256-sw)); fi
    magick "$tmp/trim.png" -filter point -resize "${sw}x${sh}!" "$tmp/scaled.png"
    magick -size 256x256 canvas:none "$tmp/scaled.png" -geometry "+${x}+${y}" -compose over -composite -strip PNG32:"$out/${prefix}${action}_0$((n+1)).png"
  done
done
