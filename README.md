# PhotonEsTuDios — Gallery

Foto-Frontend für deine Kunden und Shootings.  
Zeigt Bilder direkt aus deinem S3-Bucket — kein CMS, keine Datenbank.

> **Status:** In Planung — V1 kommt nach der Website.

## Konzept

Jede Galerie = ein S3-Ordner.  
Kunden bekommen einen Link, sehen ihre Fotos, können downloaden.  
Du lädst Fotos hoch → sie erscheinen automatisch.

## Für deine Claude-Session

> "Ich bin Daniela Haering. Öffne das Gallery-Repo von PhotonEsTuDios. Ich möchte eine neue Galerie für einen Kunden anlegen. Mein AWS-Profil ist `photon`."

## Geplante Struktur

```
s3://photonestudios-gallery/
  ├── 2026-artist-name/
  │   ├── cover.jpg
  │   └── *.jpg
  └── 2026-other-artist/
      └── *.jpg
```

## Setup (kommt in V1)

- Galerie-Seite mit Passwortschutz pro Kunde
- Upload via Terminal oder Drag & Drop
- Automatische Thumbnail-Generierung

---
*PhotonEsTuDios · Granada, Andalucía*
