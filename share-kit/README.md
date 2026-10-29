# share-kit – private Künstler-Shares bauen und prüfen

Werkzeuge für `/t/<slug>` (Teaser mit Freigabe) und `/s/<slug>` (Galerie mit eigenem Passwort).
Daten eines Shares liegen **nie im Repo** (Repo ist public), sondern lokal und in
`s3://$PHOTOS_BUCKET/shares/<slug>/`. Aufbau siehe `server/utils/share.ts`.

| Datei | Zweck |
|---|---|
| `grade.py` | Rotstich-Korrektur eines Bildes (`grade.py IN OUT [preset]`) |
| `finish.py` | Haus-Finish für alle Picks, adaptiv (`finish.py SRC_DIR OUT_DIR`) |
| `release.py` | Hero-Edit, Presskit, Social-Crops, Proofs (`release.py GRADED_DIR OUT_DIR`) |
| `teaser.py` | Teaser-HTML mit Freigabe-Formular (`teaser.py FRAMES_JSON RELEASE_JSON OUT_HTML site THEME`) |
| `release.example.json` | Wortlaut der Freigabe → als `shares/<slug>/release.json` hochladen |
| `release_pdf.mjs` | Unterschriebene Freigabe als A4-PDF (`node release_pdf.mjs CONSENT_JSON OUT.pdf`) |
| `share_e2e.mjs` | Ende-zu-Ende-Test Teaser → Gate → Galerie (`SHARE_PW=… node share_e2e.mjs`) |
| `release_e2e.mjs` | Teaser + Freigabe-Formular auf Mobil/Desktop prüfen |
| `lbcheck.mjs` | Lightbox-Layout in WebKit + Chromium prüfen |

Test-Skripte: `BASE` (Standard `https://gallery.photonestudios.com`), `SLUG`
(Standard `this-is-mama-lou`), `OUT` (Ordner/Präfix für Screenshots).
Neuer Share = Assets + `share.json` lokal bauen, `aws s3 sync` nach `shares/<slug>/`, kein Redeploy nötig.
