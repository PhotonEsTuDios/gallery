# PhotonEsTuDios — Gallery

Passwortgeschützte Foto-Galerie für PhotonEsTuDios.
**Nuxt 4 + Tailwind**, SSR (Nitro). Liest die Fotos direkt aus der DynamoDB-Tabelle
`photonestudios-photos` und erzeugt Thumbnails on-the-fly aus dem S3-Bucket
`photonestudios-photos` (mit persistentem S3-Cache + CloudFront-Edge-Cache).

Ziel-URL: **https://gallery.photonestudios.com**

## Architektur
```
Browser ──► CloudFront ──► Lambda (Nuxt/Nitro SSR)
                              ├─ POST /api/login      Passwort → signiertes Cookie
                              ├─ GET  /api/albums     DynamoDB-Scan, nach source_path gruppiert
                              ├─ GET  /api/album/:n   Fotos eines Albums
                              └─ GET  /img/:sha?w=    Thumbnail-Proxy
                                      ├─ S3 thumbs/<sha>_<w>.webp  (persistent)
                                      └─ sonst: Original aus S3 → sharp → WebP → write-through
```
- **Alben** = die Dropbox-Ordner (`source_path`), z.B. `/Julie 2016/…` → Album „Julie 2016".
- **Passwort** lebt nur serverseitig (`.env` lokal, Lambda-Env in Prod), nie im Client/Git.
- Thumbnail-Breiten: 200 / 400 / 800 / 1600. Download = `?dl=1` (Original).

## Lokal starten (gegen echte Daten)
```bash
cd ~/PhotonEsTuDios/gallery
cp .env.example .env        # GALLERY_PASSWORD + SESSION_SECRET (openssl rand -hex 32) setzen
#   .env enthält außerdem AWS_PROFILE=photon  → liest DynamoDB/S3 mit deinen Rechten
npm install
npm run dev                 # http://localhost:3000
```
Lesen aus DynamoDB + S3 und **Schreiben** der Thumbnails (`thumbs/`) funktioniert mit
dem `photon`-Profil schon heute — Login mit deinem Passwort.

## Deploy (nach Rainer-Setup)
1. Rainer richtet AWS ein → siehe [`infra/RAINER-gallery-setup.md`](infra/RAINER-gallery-setup.md).
2. `.deploy.env` anlegen (FUNCTION_NAME, DISTRIBUTION_ID, AWS_PROFILE, AWS_REGION).
3. `./deploy.sh`

## Sicherheit
- `.env` / `.deploy.env` sind gitignored. **Niemals** Passwort/Secret committen.
- Cookie ist HttpOnly + signiert (HMAC), 30 Tage gültig.

---
*PhotonEsTuDios · Granada, Andalucía*
