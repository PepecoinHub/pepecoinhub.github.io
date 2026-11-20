#!/usr/bin/env bash
# Usage: bash export-care.sh {tadpole|adult} feed.png clean.png play.png rest.png
#        bash export-care.sh --depart {tadpole|froglet|adult} walk.png [adult-turn.png]
#        bash export-care.sh --states {tadpole|froglet|adult} states.png
# Mechanical atlas slicing and alignment; no changes to the active room art.
set -euo pipefail
mode=care
if [[ $1 == --depart ]]; then mode=depart; shift; fi
if [[ $1 == --states ]]; then mode=states; shift; fi
stage=$1; shift
target_center=127
case "$stage" in
  tadpole) prefix=care_tadpole_; body_height=140;;
  adult) prefix=care_; body_height=225;;
  froglet) prefix=care_froglet_; body_height=184; target_center=135;;
  *) exit 2;;
esac
if [[ $mode == care ]]; then
  [[ $# == 4 ]] || exit 2
  actions=(feed clean play rest)
elif [[ $mode == states ]]; then
  [[ $# == 1 ]] || exit 2
  actions=(states)
  states=(idle hungry dirty moody tired neglected packing recovering)
elif [[ $stage == adult ]]; then
  [[ $# == 2 ]] || exit 2
  actions=(walk turn)
else
  [[ $# == 1 ]] || exit 2
  actions=(walk)
fi
out="$(cd "$(dirname "$0")" && pwd)/frames"
tmp=$(mktemp -d)
trap 'rm -f "$tmp/cell.png" "$tmp/trim.png" "$tmp/mask.png" "$tmp/scaled.png"; rmdir "$tmp"' EXIT

for action in "${actions[@]}"; do
  sheet=$1; shift
  read -r width height < <(magick identify -format '%w %h\n' "$sheet")
  split=$((width / 2))
  # The generator leaves the gap slightly left of center in these two atlases.
  if [[ $stage == tadpole && $action == feed ]]; then split=$((width * 47 / 100)); fi
  if [[ $stage == tadpole && $action == rest ]]; then split=$((width * 483 / 1000)); fi
  rows=2; cols=2; start=0
  if [[ $action == turn ]]; then rows=1; fi
  if [[ $action == states ]]; then cols=4; start=1; fi
  for ((n=start; n<cols*rows; n++)); do
    x=$((n % 2 * split)); y=$((n / 2 * (height / rows)))
    w=$((n % 2 == 0 ? split : width-split)); h=$((height / rows + n / 2 * (height % rows)))
    if [[ $action == states ]]; then
      x=$((n % cols * width / cols)); y=$((n / cols * height / rows))
      w=$(((n % cols + 1)*width/cols-x)); h=$(((n / cols + 1)*height/rows-y))
    fi
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
    x=$((target_center-center))
    if ((x<0)); then x=0; fi
    if ((x+sw>256)); then x=$((256-sw)); fi
    magick "$tmp/trim.png" -filter point -resize "${sw}x${sh}!" "$tmp/scaled.png"
    if [[ $mode == depart && $stage == adult ]]; then
      # A thin generated ground stroke runs across the bottom of these six cells.
      # Trim only its full-width rows, then place the remaining feet on the floor.
      if [[ $action == turn || $n == 2 ]]; then sh=$((sh-3)); else sh=$((sh-4)); fi
      magick "$tmp/scaled.png" -crop "${sw}x${sh}+0+0" +repage "$tmp/scaled.png"
    fi
    y=$((248-sh))
    name="${prefix}${action}_0$((n+1))"
    if [[ $mode == depart ]]; then
      case "$stage" in
        tadpole) name="tadpole_depart_0$((n+1))";;
        froglet) name="froglet_depart_walk_0$((n+1))";;
        adult) name="depart_${action}_0$((n+1))";;
      esac
    fi
    if [[ $mode == states ]]; then name="pepegochi_${stage}_${states[n]}"; fi
    magick -size 256x256 canvas:none "$tmp/scaled.png" -geometry "+${x}+${y}" -compose over -composite -strip PNG32:"$out/$name.png"
  done
done
