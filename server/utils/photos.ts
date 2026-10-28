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
  kind: 'photo' | 'video'
  // Auto-Label-Felder (optional, vom labeler.py gesetzt)
  quality_score?: number
  blurry?: boolean
  colors?: string[]
  gps_lat?: number
  gps_lon?: number
  // Aus dem EXIF-Header (camera_extract.py)
  camera_make?: string
  camera_model?: string
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
const VIDEO_EXTS = new Set(['mov', 'mp4', 'm4v'])
// 'photo' = thumbnail-bar, 'video' = abspielbar, null = RAW/sonstiges (nicht darstellbar)
function mediaKind(key: string): 'photo' | 'video' | null {
  const ext = key.toLowerCase().split('.').pop() || ''
  if (IMAGE_EXTS.has(ext)) return 'photo'
  if (VIDEO_EXTS.has(ext)) return 'video'
  return null
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
        ProjectionExpression:
          'sha256, s3_key, original_filename, source_path, #b, uploaded_at, taken_at, quality_score, blurry, dominant_colors, gps_lat, gps_lon, camera_make, camera_model',
        ExpressionAttributeNames: { '#b': 'bytes' },
        ExclusiveStartKey,
      }),
    )
    for (const it of res.Items ?? []) {
      // interne Steuer-Items überspringen (z.B. __dropbox_cursor__, __writetest__)
      if (!it.s3_key || String(it.sha256).startsWith('__')) continue
      // RAW/Unbekanntes raus; Videos bleiben (per kind markiert)
      const kind = mediaKind(it.s3_key)
      if (!kind) continue
      photos.push({
        sha: it.sha256,
        s3_key: it.s3_key,
        filename: it.original_filename ?? it.s3_key,
        album: albumOf(it.source_path, it.uploaded_at),
        bytes: Number(it.bytes ?? 0),
        uploaded_at: it.uploaded_at ?? '',
        taken_at: it.taken_at ?? null,
        kind,
        quality_score: it.quality_score != null ? Number(it.quality_score) : undefined,
        blurry: it.blurry === true,
        colors: Array.isArray(it.dominant_colors) ? it.dominant_colors : undefined,
        gps_lat: it.gps_lat != null ? Number(it.gps_lat) : undefined,
        gps_lon: it.gps_lon != null ? Number(it.gps_lon) : undefined,
        camera_make: it.camera_make || undefined,
        camera_model: it.camera_model || undefined,
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
      cover: (arr.find((p) => p.kind === 'photo') ?? arr[0]).sha,
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
    months.push({ ym, label: labelOf(ym), count: arr.length, cover: (arr.find((p) => p.kind === 'photo') ?? arr[0]).sha })
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
  kind: 'photo' | 'video'
}

export async function getTimelineMonth(region: string, table: string, ym: string): Promise<TimelinePhoto[]> {
  const photos = await getAllPhotos(region, table)
  return photos
    .filter((p) => ymOf(p) === ym)
    .sort(byNewest)
    .map((p) => ({ sha: p.sha, filename: p.filename, bytes: p.bytes, uploaded_at: p.uploaded_at, kind: p.kind }))
}

// ---- Labels (Auto-Labeling) ------------------------------------------------
// Ordnet einen Hex-Farbwert einer groben Farbfamilie zu (fürs "nach Farbe"-Filtern).
export function colorFamily(hex?: string): string {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return 'Neutral'
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  const v = max
  const s = max === 0 ? 0 : d / max
  let h = 0
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6)
    else if (max === g) h = 60 * ((b - r) / d + 2)
    else h = 60 * ((r - g) / d + 4)
  }
  if (h < 0) h += 360

  if (v < 0.16) return 'Schwarz'
  if (s < 0.15 && v > 0.82) return 'Weiß'
  if (s < 0.16) return 'Grau'
  if (h < 15 || h >= 345) return 'Rot'
  if (h < 45) return v < 0.55 ? 'Braun' : 'Orange'
  if (h < 70) return 'Gelb'
  if (h < 165) return 'Grün'
  if (h < 200) return 'Türkis'
  if (h < 255) return 'Blau'
  if (h < 300) return 'Lila'
  return 'Pink'
}

export interface LabeledPhoto {
  sha: string
  filename: string
  quality: number
  blurry: boolean
  colors: string[]
  family: string
}

// Alle bereits gelabelten Fotos (quality_score gesetzt), beste Qualität zuerst.
// Bei sehr großem Bestand auf MAX begrenzt — fürs Frontend handlich.
const LABELS_MAX = 4000
export async function getLabeled(region: string, table: string): Promise<{ count: number; items: LabeledPhoto[] }> {
  const photos = await getAllPhotos(region, table)
  const labeled = photos.filter((p) => p.quality_score != null)
  const items = labeled
    .map((p) => ({
      sha: p.sha,
      filename: p.filename,
      quality: p.quality_score ?? 0,
      blurry: !!p.blurry,
      colors: p.colors ?? [],
      family: colorFamily((p.colors ?? [])[0]),
    }))
    .sort((a, b) => b.quality - a.quality)
    .slice(0, LABELS_MAX)
  return { count: labeled.length, items }
}

// ---- Map (nach Ort) --------------------------------------------------------
export interface MapPin {
  sha: string
  filename: string
  lat: number
  lon: number
}

export async function getMapPins(region: string, table: string): Promise<{ count: number; pins: MapPin[] }> {
  const photos = await getAllPhotos(region, table)
  const pins = photos
    .filter((p) => p.gps_lat != null && p.gps_lon != null)
    .map((p) => ({ sha: p.sha, filename: p.filename, lat: p.gps_lat!, lon: p.gps_lon! }))
  return { count: pins.length, pins }
}

// ---- Nikon (Danielas eigene Kameras) -------------------------------------
export interface CameraPhoto {
  sha: string
  filename: string
  kind: 'photo' | 'video'
  model: string
  taken_at: string
  blurry: boolean
}

// Alles, was mit einer Nikon aufgenommen wurde, neueste Aufnahme zuerst.
// Modellname ohne doppeltes "NIKON" ("NIKON Z 6_2" -> "Z 6_2").
export async function getNikonPhotos(region: string, table: string): Promise<CameraPhoto[]> {
  const photos = await getAllPhotos(region, table)
  return photos
    .filter((p) => (p.camera_make ?? '').toUpperCase().includes('NIKON') && !HIDDEN_ALBUMS.has(p.album))
    .map((p) => ({
      sha: p.sha,
      filename: p.filename,
      kind: p.kind,
      model: (p.camera_model ?? '').replace(/^NIKON\s+/i, '').trim() || 'Nikon',
      taken_at: p.taken_at ?? p.uploaded_at,
      blurry: !!p.blurry,
    }))
    .sort((a, b) => (a.taken_at < b.taken_at ? 1 : -1))
}
