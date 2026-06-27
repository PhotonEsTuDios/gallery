import { ScanCommand } from '@aws-sdk/lib-dynamodb'
import { ddb } from './aws'

export interface Photo {
  sha: string
  s3_key: string
  filename: string
  album: string
  bytes: number
  uploaded_at: string
  taken_at: string | null
}

export interface Album {
  name: string
  count: number
  cover: string // sha des Titelbilds
  latest: string // jüngstes uploaded_at
}

// Album bestimmen:
//  - liegt das Bild in einem benannten Unterordner -> dieser Ordner ("Julie 2014")
//  - lose Handy-Uploads (direkt in "Kamera-Uploads") oder ohne Ordner
//    -> nach Jahr gruppiert ("Schnappschüsse 2014"), sonst landet alles in einem Klumpen
function albumOf(sourcePath: string | undefined, dateIso: string | undefined): string {
  const parts = (sourcePath || '').split('/').filter(Boolean)
  const parent = parts.length >= 2 ? parts[parts.length - 2] : ''
  if (parent && parent !== 'Kamera-Uploads') return parent
  const year = (dateIso || '').slice(0, 4)
  return year ? `Schnappschüsse ${year}` : 'Sonstige'
}

// Ordner, die keine echten Fotos sind und nicht in der Galerie auftauchen.
const HIDDEN_ALBUMS = new Set(['Claude-Workspace'])

// Nur Formate, die der Thumbnail-Proxy (sharp) rendern kann.
// (RAW .nef und Videos .mov/.mp4 fliegen raus -> keine kaputten Kacheln.)
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])
function isImage(key: string): boolean {
  const ext = key.toLowerCase().split('.').pop() || ''
  return IMAGE_EXTS.has(ext)
}

// Jahr aus dem Albumnamen ziehen ("2019-Jungle Book" -> 2019), für die Sortierung.
function albumYear(name: string): number {
  const m = name.match(/(19|20)\d{2}/)
  return m ? Number(m[0]) : 0
}

// Lambda-/Node-Prozess hält den Scan 5 Minuten im RAM.
const TTL_MS = 5 * 60 * 1000
let cache: { at: number; photos: Photo[] } | null = null

export async function getAllPhotos(region: string, table: string): Promise<Photo[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.photos

  const doc = ddb(region)
  const photos: Photo[] = []
  let ExclusiveStartKey: Record<string, any> | undefined

  do {
    const res = await doc.send(
      new ScanCommand({
        TableName: table,
        ProjectionExpression: 'sha256, s3_key, original_filename, source_path, #b, uploaded_at, taken_at',
        ExpressionAttributeNames: { '#b': 'bytes' },
        ExclusiveStartKey,
      }),
    )
    for (const it of res.Items ?? []) {
      // interne Steuer-Items überspringen (z.B. __dropbox_cursor__, __writetest__)
      if (!it.s3_key || String(it.sha256).startsWith('__')) continue
      // Videos / RAW raus – nur thumbnail-bare Bilder
      if (!isImage(it.s3_key)) continue
      photos.push({
        sha: it.sha256,
        s3_key: it.s3_key,
        filename: it.original_filename ?? it.s3_key,
        album: albumOf(it.source_path, it.uploaded_at),
        bytes: Number(it.bytes ?? 0),
        uploaded_at: it.uploaded_at ?? '',
        taken_at: it.taken_at ?? null,
      })
    }
    ExclusiveStartKey = res.LastEvaluatedKey
  } while (ExclusiveStartKey)

  cache = { at: Date.now(), photos }
  return photos
}

export async function getAlbums(region: string, table: string): Promise<Album[]> {
  const photos = await getAllPhotos(region, table)
  const map = new Map<string, Photo[]>()
  for (const p of photos) {
    const arr = map.get(p.album)
    if (arr) arr.push(p)
    else map.set(p.album, [p])
  }
  const albums: Album[] = []
  for (const [name, arr] of map) {
    if (HIDDEN_ALBUMS.has(name)) continue
    arr.sort((a, b) => (a.uploaded_at < b.uploaded_at ? 1 : -1))
    albums.push({
      name,
      count: arr.length,
      cover: arr[0].sha,
      latest: arr[0].uploaded_at,
    })
  }
  // chronologisch: jüngstes Jahr zuerst; bei gleichem/keinem Jahr nach Upload-Datum
  albums.sort((a, b) => albumYear(b.name) - albumYear(a.name) || (a.latest < b.latest ? 1 : -1))
  return albums
}

export async function getAlbumPhotos(region: string, table: string, album: string): Promise<Photo[]> {
  const photos = await getAllPhotos(region, table)
  return photos
    .filter((p) => p.album === album)
    .sort((a, b) => (a.filename < b.filename ? -1 : 1))
}

// ---- Timeline (nach Monat) -------------------------------------------------
// Datum = uploaded_at (taken_at ist aktuell leer; kommt mit dem EXIF-Ausbau).
export interface TimelineMonth {
  ym: string // "2026-06"  bzw. "0000-00" für Fotos ohne Datum
  label: string // "Juni 2026"
  count: number
  cover: string // sha des Titelbilds (jüngstes des Monats)
}

const MONTHS_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

function ymOf(p: Photo): string {
  return (p.uploaded_at || '').slice(0, 7) || '0000-00'
}

function labelOf(ym: string): string {
  if (ym === '0000-00') return 'Ohne Datum'
  const [y, m] = ym.split('-')
  return `${MONTHS_DE[Number(m) - 1] ?? m} ${y}`
}

// Innerhalb eines Monats: jüngstes zuerst (uploaded_at desc), dann Dateiname.
function byNewest(a: Photo, b: Photo): number {
  if (a.uploaded_at !== b.uploaded_at) return a.uploaded_at < b.uploaded_at ? 1 : -1
  return a.filename < b.filename ? -1 : 1
}

export async function getTimelineIndex(region: string, table: string): Promise<TimelineMonth[]> {
  const photos = await getAllPhotos(region, table)
  const map = new Map<string, Photo[]>()
  for (const p of photos) {
    const ym = ymOf(p)
    const arr = map.get(ym)
    if (arr) arr.push(p)
    else map.set(ym, [p])
  }
  const months: TimelineMonth[] = []
  for (const [ym, arr] of map) {
    arr.sort(byNewest)
    months.push({ ym, label: labelOf(ym), count: arr.length, cover: arr[0].sha })
  }
  // neueste Monate zuerst; "Ohne Datum" (0000-00) landet damit ganz unten
  months.sort((a, b) => (a.ym < b.ym ? 1 : a.ym > b.ym ? -1 : 0))
  return months
}

export interface TimelinePhoto {
  sha: string
  filename: string
  bytes: number
  uploaded_at: string
}

export async function getTimelineMonth(region: string, table: string, ym: string): Promise<TimelinePhoto[]> {
  const photos = await getAllPhotos(region, table)
  return photos
    .filter((p) => ymOf(p) === ym)
    .sort(byNewest)
    .map((p) => ({ sha: p.sha, filename: p.filename, bytes: p.bytes, uploaded_at: p.uploaded_at }))
}
