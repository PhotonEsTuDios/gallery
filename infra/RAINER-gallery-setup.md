# Rainer-Checkliste — gallery.photonestudios.com

Einmaliges AWS-Setup, damit Daniela die Gallery selbst per `deploy.sh` deployen kann.

- **Account:** 030760499811
- **Region:** eu-west-1 (TLS/CloudFront-Sachen in **us-east-1**)
- **IAM-User:** `daniela-haering` (Profil `photon`)
- **App:** Nuxt 4 SSR, läuft als Lambda hinter CloudFront, liest DynamoDB
  `photonestudios-photos`, erzeugt Thumbnails on-the-fly und cached sie in
  `s3://photonestudios-photos/thumbs/`.

## 1. Lambda-Exec-Rolle `photon-gallery-exec`
Trust: `lambda.amazonaws.com`. Inline-Policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow",
      "Action": ["dynamodb:GetItem","dynamodb:Query","dynamodb:Scan"],
      "Resource": "arn:aws:dynamodb:eu-west-1:030760499811:table/photonestudios-photos" },
    { "Effect": "Allow",
      "Action": ["s3:GetObject","s3:PutObject"],
      "Resource": "arn:aws:s3:::photonestudios-photos/*" }
  ]
}
```
Plus Managed Policy `AWSLambdaBasicExecutionRole` (CloudWatch-Logs).

## 2. Lambda-Funktion `photon-gallery`
- Runtime **Node.js 22**, Architektur **arm64**, Memory **1024 MB**, Timeout **30 s**
- Rolle: `photon-gallery-exec`
- **Function URL** aktiv, AuthType **NONE** (Auth macht die App per Passwort-Cookie)
- Platzhalter-Code reicht – Daniela deployt den echten Code per Script.
- Env-Variablen setzt das Deploy-Script (GALLERY_PASSWORD, SESSION_SECRET, …).

## 3. ACM-Zertifikat (us-east-1)
Für `gallery.photonestudios.com`, DNS-validiert.

## 4. CloudFront-Distribution
- Origin: die **Function URL** aus (2)
- Alternate Domain Name (CNAME): `gallery.photonestudios.com` + Zertifikat aus (3)
- **Cache-Policy:** Query-String `w` cachen/weiterleiten; **Cookies weiterleiten**
  (Login-Cookie `photon_gallery`); `Authorization` nicht nötig.
- Default-TTL moderat; `/img/*` ist `immutable` (cached lange von selbst).

## 5. Route53
A/AAAA-Alias `gallery.photonestudios.com` → die CloudFront-Distribution.

## 6. Deploy-Policy an `daniela-haering`
Damit sie künftig selbst deployt:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow",
      "Action": ["lambda:UpdateFunctionCode","lambda:UpdateFunctionConfiguration","lambda:GetFunction"],
      "Resource": "arn:aws:lambda:eu-west-1:030760499811:function:photon-gallery" },
    { "Effect": "Allow",
      "Action": ["cloudfront:CreateInvalidation"],
      "Resource": "arn:aws:cloudfront::030760499811:distribution/<DISTRIBUTION_ID>" }
  ]
}
```
S3- und DynamoDB-Rechte hat sie bereits.

## Zurück an Daniela
- **Function-Name** (= `photon-gallery`) und **DISTRIBUTION_ID** → in `.deploy.env` eintragen.
