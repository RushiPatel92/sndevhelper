#!/usr/bin/env bash
#
# Build a clean Chrome Web Store / distribution zip.
# Run from the project root:  bash package.sh
#
# ALLOWLIST, not exclusion. The old exclusion list shipped anything it had not
# been told to skip, so every dev file added since — plan docs, agent configs,
# .github/ — silently ended up in the distributable. Naming what ships inverts
# the failure mode: the risk is now a NEW asset being left out, which the
# manifest cross-check below turns into a loud build failure instead of a
# broken install.
set -euo pipefail

OUT="sn-dev-helper.zip"

SHIP=(
  manifest.json
  background.js
  content.js
  debug_timeline_main.js
  debug_timeline_ui.js
  hidden_variables_ui.js
  popup.html
  popup.js
  popup.css
  icons
)

for item in "${SHIP[@]}"; do
  [ -e "$item" ] || { echo "package.sh: missing '$item'" >&2; exit 1; }
done

rm -f "$OUT"
zip -rq "$OUT" "${SHIP[@]}" -x '*/.DS_Store' '.DS_Store'

# Cross-check the allowlist against what the manifest actually references, so
# adding a script or asset to manifest.json without adding it to SHIP fails the
# build rather than producing a zip that breaks on load. Covers manifest
# references only — popup.js/popup.css are pulled in by popup.html, and
# debug_timeline_main.js is injected on demand, so those still rely on SHIP.
#
# -Z1 lists bare paths (one per line, no column parsing), and separators are
# normalised because some archivers write backslashes. Match whole lines: a
# substring match would accept a partial path.
listing="$(unzip -Z1 "$OUT" | tr '\\' '/')"
missing=0
while read -r ref; do
  [ -n "$ref" ] || continue
  if ! printf '%s\n' "$listing" | grep -qxF "$ref"; then
    echo "package.sh: manifest references '$ref' but it is not in $OUT" >&2
    echo "            add it to the SHIP list." >&2
    missing=1
  fi
done < <(grep -oE '"[^"]+\.(js|html|css|png|svg|json)"' manifest.json \
           | tr -d '"' | sort -u)

[ "$missing" -eq 0 ] || { rm -f "$OUT"; exit 1; }

echo "Built $OUT"
echo "Contents:"
unzip -l "$OUT"
