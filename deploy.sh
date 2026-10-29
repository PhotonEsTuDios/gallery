#!/usr/bin/env bash
# Deploy der PhotonEsTuDios-Gallery nach AWS Lambda + CloudFront.
#
# Einmalig von Rainer eingerichtet (siehe infra/RAINER-gallery-setup.md):
#   Lambda photon-gallery (Node 22, arm64) hinter CloudFront OAC + AWS_IAM,
#   Deploy-Rechte am IAM-User daniela-haering.
#
# .deploy.env (gitignored) liefert:
#   FUNCTION_NAME=photon-gallery
#   DISTRIBUTION_ID=E6NIDGDE02P23
#   AWS_PROFILE=photon
#   AWS_REGION=eu-west-1
#   PHOTOS_BUCKET=… (optional, sonst aus .env)
set -euo pipefail
cd "$(dirname "$0")"

# DEPLOY_ENV wählt das Ziel, z.B. DEPLOY_ENV=.deploy.env.photon-new ./deploy.sh
DEPLOY_ENV="${DEPLOY_ENV:-.deploy.env}"
[ -f "$DEPLOY_ENV" ] || { echo "✗ $DEPLOY_ENV fehlt (siehe Kopf von deploy.sh)"; exit 1; }
[ -f .env ]          || { echo "✗ .env fehlt (GALLERY_PASSWORD / SESSION_SECRET)"; exit 1; }
# .env zuerst, dann das Ziel: Profil/Bucket aus DEPLOY_ENV gewinnen.
set -a; . ./.env; . "./$DEPLOY_ENV"; set +a

: "${FUNCTION_NAME:?FUNCTION_NAME fehlt in .deploy.env}"
: "${DISTRIBUTION_ID:?DISTRIBUTION_ID fehlt in .deploy.env}"
: "${AWS_REGION:=eu-west-1}"
# Versionen müssen zu sharp in package.json passen:
SHARP_VERSION="${SHARP_VERSION:-0.35.1}"
LIBVIPS_VERSION="${LIBVIPS_VERSION:-1.3.0}"

echo "▸ 1/6  Build (Nitro aws-lambda, serveStatic)…"
NITRO_PRESET=aws-lambda npm run build

echo "▸ 2/6  sharp-Binary für linux-arm64 einsetzen…"
# Nitro bündelt nur das Host-Binary (darwin). Wir holen das Lambda-Binary (linux-arm64)
# in einem sauberen Temp-Ordner per Namen (--force umgeht die os/cpu-Prüfung) und
# kopieren es ins Bundle. Direktes npm-install in .output/server scheitert an
# fremden Postinstall-Skripten – daher der Temp-Umweg.
TMP=$(mktemp -d)
( cd "$TMP" && npm init -y >/dev/null 2>&1 && \
  npm install --no-save --ignore-scripts --force \
    "@img/sharp-linux-arm64@${SHARP_VERSION}" \
    "@img/sharp-libvips-linux-arm64@${LIBVIPS_VERSION}" >/dev/null 2>&1 )
mkdir -p .output/server/node_modules/@img
copied=0
for d in "$TMP"/node_modules/@img/*linux-arm64*; do
  [ -d "$d" ] && cp -R "$d" .output/server/node_modules/@img/ && copied=$((copied + 1))
done
rm -rf "$TMP"
[ "$copied" -ge 1 ] || { echo "  ✗ sharp linux-arm64 nicht gefunden – Abbruch"; exit 1; }
echo "  ✓ $copied linux-arm64 Pakete eingesetzt"

echo "▸ 3/6  Zippen (server/ + public/ als Geschwister)…"
# Der Handler liest Assets via ../public relativ zu server/ -> beide müssen ins Zip,
# und der Lambda-Handler zeigt auf server/index.handler (siehe Schritt 4).
rm -f function.zip
( cd .output && zip -qr ../function.zip server public )
echo "  ✓ $(du -h function.zip | cut -f1)"

echo "▸ 4/6  Lambda-Konfiguration (Handler + Env)…"
aws lambda update-function-configuration \
  --function-name "$FUNCTION_NAME" --region "$AWS_REGION" --no-cli-pager \
  --handler "server/index.handler" \
  --memory-size "${LAMBDA_MEMORY:-3008}" \
  --environment "Variables={GALLERY_PASSWORD=$GALLERY_PASSWORD,SESSION_SECRET=$SESSION_SECRET,PHOTOS_BUCKET=${PHOTOS_BUCKET:-photonestudios-photos},PHOTOS_TABLE=${PHOTOS_TABLE:-photonestudios-photos}}" >/dev/null
# Speicher: Die Gallery hält den ganzen Foto-Index im RAM (87k Einträge brauchten >2 GB, Okt 2026).
# Hinweis: AWS_REGION ist reserviert und wird NICHT gesetzt (Runtime liefert sie).

echo "▸ 5/6  Code hochladen…"
# Kein 'lambda wait' (braucht GetFunctionConfiguration, nicht in der Deploy-Policy).
# Stattdessen Retry, bis das Config-Update aus Schritt 4 durch ist.
for i in $(seq 1 12); do
  if aws lambda update-function-code \
       --function-name "$FUNCTION_NAME" --region "$AWS_REGION" --no-cli-pager \
       --zip-file fileb://function.zip >/dev/null 2>/tmp/photon_lambda_err; then
    echo "  ✓ Code aktualisiert"; break
  fi
  if grep -qiE "conflict|in progress|cannot be performed" /tmp/photon_lambda_err; then
    echo "  [$i] vorheriges Update läuft noch, warte 5s…"; sleep 5; continue
  fi
  echo "  ✗ Fehler:"; cat /tmp/photon_lambda_err; exit 1
done

echo "▸ 6/6  CloudFront-Cache leeren…"
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" --no-cli-pager >/dev/null && echo "  ✓ Invalidation gestartet"

rm -f function.zip
echo "✅ Deploy fertig ($DEPLOY_ENV, $AWS_PROFILE, $FUNCTION_NAME)"
