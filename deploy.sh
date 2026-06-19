#!/usr/bin/env bash
# Deploy der PhotonEsTuDios-Gallery nach AWS Lambda + CloudFront.
#
# Voraussetzung (einmalig von Rainer eingerichtet, siehe infra/RAINER-gallery-setup.md):
#   - Lambda-Funktion  photon-gallery  (Node 22, arm64, Function URL)
#   - CloudFront-Distribution für gallery.photonestudios.com
#   - Deploy-Policy am IAM-User daniela-haering
#
# Konfiguration: lege eine .deploy.env an (gitignored) mit:
#   FUNCTION_NAME=photon-gallery
#   DISTRIBUTION_ID=E........
#   AWS_PROFILE=photon
#   AWS_REGION=eu-west-1
set -euo pipefail
cd "$(dirname "$0")"

[ -f .deploy.env ] || { echo "✗ .deploy.env fehlt (siehe Kopf von deploy.sh)"; exit 1; }
[ -f .env ]        || { echo "✗ .env fehlt (GALLERY_PASSWORD / SESSION_SECRET)"; exit 1; }
set -a; . ./.deploy.env; . ./.env; set +a

: "${FUNCTION_NAME:?FUNCTION_NAME fehlt in .deploy.env}"
: "${AWS_REGION:=eu-west-1}"
LAMBDA_ARCH="${LAMBDA_ARCH:-arm64}"   # muss zur Lambda-Architektur passen

echo "▸ 1/5  Build (Nitro aws-lambda)…"
NITRO_PRESET=aws-lambda npm run build

echo "▸ 2/5  sharp-Binary für linux-${LAMBDA_ARCH} einsetzen…"
# Nitro hält native Module extern -> wir tauschen das Binary auf die Lambda-Plattform.
( cd .output/server \
  && npm install --no-save --no-package-lock \
       --os=linux --cpu="${LAMBDA_ARCH}" sharp@0.35.1 >/dev/null 2>&1 \
  || echo "  ! sharp-Reinstall übersprungen – Thumbnails in Prod prüfen!" )

echo "▸ 3/5  Zippen…"
rm -f function.zip
( cd .output/server && zip -qr ../../function.zip . )

echo "▸ 4/5  Lambda-Code + Konfiguration aktualisieren…"
aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file fileb://function.zip \
  --region "$AWS_REGION" --no-cli-pager >/dev/null

aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$AWS_REGION"

aws lambda update-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --region "$AWS_REGION" --no-cli-pager \
  --environment "Variables={GALLERY_PASSWORD=$GALLERY_PASSWORD,SESSION_SECRET=$SESSION_SECRET,PHOTOS_BUCKET=${PHOTOS_BUCKET:-photonestudios-photos},PHOTOS_TABLE=${PHOTOS_TABLE:-photonestudios-photos}}" >/dev/null
# Hinweis: AWS_REGION ist ein reservierter Lambda-Env-Name und wird NICHT gesetzt –
# die Runtime liefert die Region selbst (eu-west-1).

echo "▸ 5/5  CloudFront-Cache leeren…"
if [ -n "${DISTRIBUTION_ID:-}" ]; then
  aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*" --region "$AWS_REGION" --no-cli-pager >/dev/null \
    && echo "  ✓ Invalidation gestartet"
else
  echo "  ! DISTRIBUTION_ID fehlt – Cache nicht geleert (TTL abwarten)."
fi

rm -f function.zip
echo "✅ Deploy fertig → https://gallery.photonestudios.com"
