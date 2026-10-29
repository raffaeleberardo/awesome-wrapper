#!/usr/bin/env sh
# Pubblica le immagini su GitHub Container Registry e prepara lo zip del kit da condividere.
#   scripts/publish-kit.sh            immagini (amd64 + arm64) + zip
#   scripts/publish-kit.sh --zip-only solo lo zip in dist/
# Prima volta: docker login ghcr.io (token GitHub con scope write:packages).
set -eu

REGISTRY=ghcr.io/raffaeleberardo
SOURCE=https://github.com/raffaeleberardo/awesome-wrapper
PLATFORMS=linux/amd64,linux/arm64
cd "$(dirname "$0")/.."

if [ "${1:-}" != "--zip-only" ]; then
  # Le immagini devono corrispondere a un commit preciso: niente modifiche in sospeso.
  if [ -n "$(git status --porcelain)" ]; then
    echo "Ci sono modifiche non committate: fai prima il commit." >&2
    exit 1
  fi
  VERSION=$(git rev-parse --short HEAD)
  for app in api web; do
    echo "==> git-wrapped-$app ($VERSION, $PLATFORMS)"
    docker buildx build \
      --platform "$PLATFORMS" \
      --file "docker/$app.Dockerfile" \
      --label "org.opencontainers.image.source=$SOURCE" \
      --label "org.opencontainers.image.revision=$VERSION" \
      --tag "$REGISTRY/git-wrapped-$app:$VERSION" \
      --tag "$REGISTRY/git-wrapped-$app:latest" \
      --push .
  done
fi

mkdir -p dist
rm -f dist/git-wrapped-kit.zip
(cd kit && zip -q -X ../dist/git-wrapped-kit.zip compose.yaml env.example LEGGIMI.txt)
echo "==> Kit pronto: dist/git-wrapped-kit.zip"
