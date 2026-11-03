#!/usr/bin/env bash
# Rechte der Gallery-Lambda (Rolle photon-gallery-exec) als Code — idempotent, wird von deploy.sh aufgerufen.
# Ersetzt die Inline-Policy gallery-data komplett: Was hier nicht steht, darf die Gallery nicht.
#   AWS_PROFILE=photon-new PHOTOS_BUCKET=photonestudios-archive ./infra/iam.sh
set -euo pipefail
R=${AWS_REGION:-eu-west-1}; ROLE=${GALLERY_ROLE:-photon-gallery-exec}
B=${PHOTOS_BUCKET:?PHOTOS_BUCKET fehlt}; T=${PHOTOS_TABLE:-photonestudios-photos}
FT=${FACES_TABLE:-photonestudios-faces}; FN=${FACES_FUNCTION:-photon-faces}
A=$(aws sts get-caller-identity --query Account --output text)
aws iam put-role-policy --role-name "$ROLE" --policy-name gallery-data --policy-document "{
 \"Version\":\"2012-10-17\",\"Statement\":[
  {\"Sid\":\"Fotos\",\"Effect\":\"Allow\",\"Action\":[\"dynamodb:GetItem\",\"dynamodb:Query\",\"dynamodb:Scan\"],
   \"Resource\":\"arn:aws:dynamodb:$R:$A:table/$T\"},
  {\"Sid\":\"Gesichter\",\"Effect\":\"Allow\",\"Action\":[\"dynamodb:Query\"],
   \"Resource\":[\"arn:aws:dynamodb:$R:$A:table/$FT\",\"arn:aws:dynamodb:$R:$A:table/$FT/index/cluster-index\"]},
  {\"Sid\":\"Archiv\",\"Effect\":\"Allow\",\"Action\":[\"s3:GetObject\",\"s3:PutObject\"],
   \"Resource\":\"arn:aws:s3:::$B/*\"},
  {\"Sid\":\"Benennen\",\"Effect\":\"Allow\",\"Action\":[\"lambda:InvokeFunction\"],
   \"Resource\":\"arn:aws:lambda:$R:$A:function:$FN\"}
 ]}"
echo "  ✓ Rechte $ROLE (Fotos, Gesichter lesen, Archiv, photon-faces aufrufen)"
