#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="v$(node -p "require('$SCRIPT_DIR/../package.json').version")"

echo "Tagging $VERSION"
git tag -f "$VERSION" && git push origin ":refs/tags/$VERSION" && git push origin "$VERSION"
