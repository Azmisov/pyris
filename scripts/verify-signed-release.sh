#!/usr/bin/env bash
# Verify a signed release zip loads cleanly in a throwaway Grafana container.
# Usage: scripts/verify-signed-release.sh <version> [grafana-image]
#   version        e.g. 1.0.9 (tag vX.Y.Z will be fetched from GitHub Releases
#                  if the zip isn't already in cwd)
#   grafana-image  optional, defaults to grafana/grafana:latest
set -euo pipefail

VERSION="${1:?usage: $0 <version> [grafana-image]}"
IMAGE="${2:-grafana/grafana:latest}"
PLUGIN_ID="nyrix-pyris-panel"
ARCHIVE="${PLUGIN_ID}-${VERSION}.zip"
REPO="nyrix/pyris"
PORT=3000
CONTAINER="pyris-signtest-$$"
WORKDIR="$(mktemp -d)"
trap 'docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; rm -rf "$WORKDIR"' EXIT

if [[ ! -f "$ARCHIVE" ]]; then
  echo "==> Downloading $ARCHIVE from GitHub Release v${VERSION}"
  gh release download "v${VERSION}" --repo "$REPO" --pattern "$ARCHIVE" --output "$ARCHIVE"
fi

echo "==> Extracting $ARCHIVE"
unzip -q -o "$ARCHIVE" -d "$WORKDIR"
chmod -R a+rX "$WORKDIR"

echo "==> Starting $IMAGE on :${PORT}"
docker run -d --rm --name "$CONTAINER" -p "${PORT}:3000" \
  -v "${WORKDIR}:/var/lib/grafana/plugins" \
  -e GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS="" \
  -e GF_LOG_LEVEL=info \
  "$IMAGE" >/dev/null

echo "==> Waiting for Grafana + plugin registration"
READY=0
for i in {1..90}; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -u admin:admin \
    "http://localhost:${PORT}/api/plugins/${PLUGIN_ID}/settings" || echo 000)
  if [[ "$code" == "200" ]]; then READY=1; break; fi
  if [[ $((i % 10)) -eq 0 ]]; then
    echo "  still waiting (i=${i}, http=${code})..."
  fi
  sleep 1
done
if [[ "$READY" != "1" ]]; then
  echo "==> Plugin endpoint never returned 200. Last logs:" >&2
  docker logs "$CONTAINER" 2>&1 | tail -100 >&2
  exit 1
fi

echo "==> Plugin signature status:"
if ! curl -fsS -u admin:admin "http://localhost:${PORT}/api/plugins/${PLUGIN_ID}/settings" \
    | jq '{id, signature, signatureType, signatureOrg}'; then
  echo "Plugin did not register. Container logs:" >&2
  docker logs "$CONTAINER" 2>&1 | tail -80 >&2
  exit 1
fi

echo
echo "==> Relevant server log lines:"
docker logs "$CONTAINER" 2>&1 | grep -iE "${PLUGIN_ID}|signature|unsigned" || true

echo
echo "==> Grafana running at http://localhost:${PORT} (admin/admin). Ctrl-C to tear down."
wait $(docker inspect -f '{{.State.Pid}}' "$CONTAINER" 2>/dev/null) 2>/dev/null || \
  docker wait "$CONTAINER" >/dev/null
