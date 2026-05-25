#!/bin/bash
# Generate a changelog from git log since the last tag.
# Usage: ./scripts/generate-changelog.sh [from-tag]

set -euo pipefail

FROM_TAG="${1:-$(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)}"
TO_REF="${2:-HEAD}"

echo "# Changelog"
echo ""
echo "**$(date +%Y-%m-%d)** — \`${FROM_TAG}\` → \`${TO_REF}\`"
echo ""

git log "${FROM_TAG}..${TO_REF}" --oneline --no-decorate --format="## %s%n%n%b%n" | \
  grep -v "^$" | \
  head -100
