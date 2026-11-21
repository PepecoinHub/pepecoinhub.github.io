#!/usr/bin/env bash
# Commit the data this run generated and push it to the branch (snapshot.yml, step "Commit data").
#
# Runs wait in a queue (concurrency: snapshot), so by the time this one pushes, an earlier run or a
# merge may already have pushed. A plain rebase is tried first. If it conflicts (the generated files:
# docs/data/*.json, the baked numbers in docs/**/*.html, docs/sitemap.xml), the rebase is aborted,
# the branch is reset to the remote tip, this run's data files are put back on top, and the pages
# are baked again from them. That keeps everyone else's edits to the HTML and this run's numbers.
#
# Usage: scripts/commit_data.sh <branch>
set -uo pipefail

branch="${1:?usage: commit_data.sh <branch>}"

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

stage() {
  git add docs/data docs/sitemap.xml ':(glob)docs/**/*.html'
}

commit_message() {
  if [ -f "docs/data/snapshots/$(date -u +%F).json" ] && ! git diff --cached --quiet -- docs/data/snapshots; then
    echo "data: snapshot $(date -u +%F)"
  else
    echo "data: prices $(date -u '+%F %H:%M') UTC"
  fi
}

stage
if ! git diff --exit-code -- docs; then
  echo "::error::files under docs/ changed but are not staged; add them to stage() in scripts/commit_data.sh"
  exit 1
fi
if git diff --cached --quiet; then
  echo "Nothing new to commit."
  exit 0
fi
git commit -q -m "$(commit_message)"

for i in 1 2 3 4; do
  if git pull --rebase origin "$branch"; then
    git push origin "HEAD:$branch" && exit 0
    echo "push attempt $i failed, retrying"
  else
    echo "rebase attempt $i conflicted, rebuilding the generated files on the new tip"
    git rebase --abort 2>/dev/null || true
    ours="$(git rev-parse HEAD)"
    data_files="$(git diff-tree --no-commit-id --name-only -r "$ours" -- docs/data)"
    git fetch -q origin "$branch" || { sleep $((i * 10)); continue; }
    git reset -q --hard FETCH_HEAD
    # this run's data wins over an older run's; nothing else from this run's commit is kept
    if [ -n "$data_files" ]; then
      echo "$data_files" | xargs git checkout "$ours" --
    fi
    node scripts/prebake.mjs
    python scripts/build_sitemap.py || echo "sitemap dates not updated"
    python scripts/keep_timestamps.py
    stage
    if git diff --cached --quiet; then
      echo "Nothing new to commit after rebuilding on the new tip."
      exit 0
    fi
    git commit -q -m "$(commit_message)"
    git push origin "HEAD:$branch" && exit 0
    echo "push attempt $i failed, retrying"
  fi
  sleep $((i * 10))
done
exit 1
