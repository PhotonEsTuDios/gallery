import { ScanCommand } from '@aws-sdk/lib-dynamodb'
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { gunzipSync, gzipSync } from 'node:zlib'
import type { H3Event } from 'h3'
import { ddb, s3, streamToBuffer } from './aws'
import { assignSessions, takenOf } from './sessions'
import { bucketLabel, bucketOf, inBucket, planSpans, sortKey, spanOf, type Span } from './buckets'
import { applyFilter, colorFamily, parseFilter, type Filter, type Origin } from './filter'

// ---- Herkunft (Quelle) -----------------------------------------------------
// Ein Foto kann aus mehreren Quellen stammen (gleicher SHA in Dropbox UND im
// Time-Machine-Backup) -> `sources` (Liste) plus das alte Einzelfeld `source`.
export function originOf(source: string | undefined): Origin {
  const s = (source || '').toLowerCase()
  if (s.startsWith('dropbox')) return 'dropbox'
  if (s.startsWith('timemachine')) return 'timemachine'
  if (s.startsWith('icloud') || s.startsWith('photos')) return 'icloud'
  return 'lokal' // mac:…, drive:…, alte lokale Läufe
}

// ---- Gemeinsamer Filter (gallery#8) ------------------------------------------
// Alle Ansichten lesen denselben Filter aus der URL (Personen, Farbe, Jahr, Herkunft), siehe filter.ts.
export function filterFrom(event: H3Event): Filter | null {
  const f = parseFilter(getQuery(event))
  // gefilterte Antworten nie in CloudFront cachen
  if (f) setHeader(event, 'cache-control', 'private, no-store')
  return f
}

function filtered(photos: Photo[], f?: Filter | null): Photo[] {
  return applyFilter(photos, f ?? null, takenOf)
}

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
  origins: Origin[]
  // Personen aus der Gesichtserkennung (staubsauger#14, gallery#7)
  persons?: string[]
}

export interface Album {
  name: string
  count: number
  cover: string // sha des Titelbilds
  latest: string // jüngstes uploaded_at
  date: string // Aufnahmedatum des Albums (JJJJ-MM-TT), Sortierung + Jahres-Gruppen
  year: number // 0 = ohne Datum
}

// Album bestimmen:
//  - liegt das Bild in einem benannten Unterordner -> dieser Ordner ("Julie 2014")
//  - lose Handy-Uploads (direkt in "Kamera-Uploads") oder ohne Ordner, Time-Machine-Pfade
//    ohne sprechenden Ordner (Fotos-Mediathek "originals/A", App-Container unter Library/,
//    Dropbox-Zip-Exporte, Downloads/Desktop lose) -> "lose" (isLoose)
//    -> werden beim Indexaufbau per Aufnahmezeit zu Sessions gebündelt (sessions.ts, staubsauger#8);
//       nur ohne jede Aufnahmezeit bleibt "Schnappschüsse JJJJ" nach Upload-Jahr
const LOOSE_FOLDERS = new Set(['Kamera-Uploads', 'Camera Uploads', 'Downloads', 'Desktop', 'Documents', 'Pictures', 'Dropbox', 'Movies'])
function parentFolder(sourcePath: string | undefined): { path: string; parent: string } {
  const path = sourcePath || ''
  const parts = path.split(/[/!]/).filter(Boolean)
  return { path, parent: parts.length >= 2 ? parts[parts.length - 2] : '' }
}
function isLoose(sourcePath: string | undefined): boolean {
  const { path, parent } = parentFolder(sourcePath)
  return (
    !parent ||
    LOOSE_FOLDERS.has(parent) ||
    path.includes('.photoslibrary/') ||
    path.startsWith('Library/') ||
    /\.zip!/i.test(path) ||
    /^[0-9A-F]$/i.test(parent) ||
    /^[0-9a-f-]{20,}$/i.test(parent)
  )
}
function albumOf(sourcePath: string | undefined, dateIso: string | undefined): string {
  if (!isLoose(sourcePath)) return parentFolder(sourcePath).parent
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

// ---- Foto-Index (gallery#2) --------------------------------------------------
// Früher: jeder Kaltstart scannte die ganze Tabelle (87k Einträge, 4–5 s, wächst mit).
// Jetzt: fertiger Index als gzip-JSON in S3. Ablauf in getAllPhotos():
//  1. RAM-Cache jünger als 1 Min -> sofort
//  2. sonst Index-Datei aus S3 laden (ETag-Abgleich: unverändert = 304, kostet fast nichts)
//  3. Datei fehlt, falsches Format, älter als 30 Min oder Personen seitdem geändert -> einmal scannen, neu schreiben
// Kosten: ein Scan ≈ 7.900 Lese-Einheiten ≈ 0,1 Cent, höchstens alle 30 Min und nur wenn jemand schaut.
const TTL_MS = 60 * 1000
const REBUILD_MS = 30 * 60 * 1000
export const INDEX_KEY = 'index/gallery-photos.json.gz'
const INDEX_VERSION = 3 // hochzählen, wenn sich Photo/albumOf ändert -> erzwingt Neuaufbau

interface IndexFile { v: number; builtAt: number; photos: Photo[] }
let cache: { at: number; builtAt: number; etag?: string; photos: Photo[] } | null = null
let inflight: Promise<Photo[]> | null = null

export async function getAllPhotos(region: string, table: string, bucket?: string): Promise<Photo[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.photos
  // parallele Anfragen teilen sich einen Lade-/Scan-Vorgang
  if (!inflight) inflight = loadIndex(region, table, bucket || useRuntimeConfig().photosBucket).finally(() => (inflight = null))
  return inflight
}

// Personen geändert (photon-faces schreibt faces/clusters.json nach jedem Benennen und nach dem
// nächtlichen Gruppieren)? Dann ist der Index veraltet -> neu bauen (gallery#10, kein Browser-Timer nötig).
async function peopleChangedAt(region: string, bucket: string): Promise<number> {
  try {
    const h = await s3(region).send(new HeadObjectCommand({ Bucket: bucket, Key: 'faces/clusters.json' }))
    return h.LastModified?.getTime() ?? 0
  } catch {
    return 0
  }
}

async function loadIndex(region: string, table: string, bucket: string): Promise<Photo[]> {
  const changed = peopleChangedAt(region, bucket)
  try {
    const res = await s3(region).send(new GetObjectCommand({ Bucket: bucket, Key: INDEX_KEY, IfNoneMatch: cache?.etag }))
    const file = JSON.parse(gunzipSync(await streamToBuffer(res.Body)).toString('utf8')) as IndexFile
    if (file.v === INDEX_VERSION && Date.now() - file.builtAt < REBUILD_MS && (await changed) <= file.builtAt) {
      cache = { at: Date.now(), builtAt: file.builtAt, etag: res.ETag, photos: file.photos }
      return file.photos
    }
  } catch (e: any) {
    const status = e?.$metadata?.httpStatusCode
    // 304 = unverändert: RAM-Stand behalten, solange er frisch genug ist
    if (status === 304 && cache && Date.now() - cache.builtAt < REBUILD_MS && (await changed) <= cache.builtAt) {
      cache.at = Date.now()
      return cache.photos
    }
    // 403/404 = Datei fehlt (ohne ListBucket-Recht meldet S3 403) -> neu bauen
    if (status !== 304 && status !== 403 && status !== 404) console.warn('[index] S3-Laden fehlgeschlagen', status, e?.name)
  }
  return rebuildIndex(region, table, bucket)
}

export async function rebuildIndex(region: string, table: string, bucket: string): Promise<Photo[]> {
  const t0 = Date.now()
  const photos = await scanPhotos(region, table)
  const builtAt = t0 // Stand = Beginn des Scans (Änderungen währenddessen lösen den nächsten Neuaufbau aus)
  let etag: string | undefined
  try {
    const body = gzipSync(JSON.stringify({ v: INDEX_VERSION, builtAt, photos } satisfies IndexFile))
    const put = await s3(region).send(
      new PutObjectCommand({ Bucket: bucket, Key: INDEX_KEY, Body: body, ContentType: 'application/json', ContentEncoding: 'gzip' }),
    )
    etag = put.ETag
    console.log(`[index] neu gebaut: ${photos.length} Einträge, ${(body.length / 1024 / 1024).toFixed(2)} MB gz, ${Date.now() - t0} ms`)
  } catch (e: any) {
    // Schreiben fehlgeschlagen -> trotzdem ausliefern, nächster Kaltstart versucht es erneut
    console.warn('[index] Schreiben fehlgeschlagen', e?.name)
  }
  cache = { at: Date.now(), builtAt, etag, photos }
  return photos
}

async function scanPhotos(region: string, table: string): Promise<Photo[]> {
  const doc = ddb(region)
  const photos: Photo[] = []
  const loose = new Set<string>() // shas ohne sprechenden Ordner -> Sessions
  let ExclusiveStartKey: Record<string, any> | undefined

  do {
    const res = await doc.send(
      new ScanCommand({
        TableName: table,
        ProjectionExpression:
          'sha256, s3_key, original_filename, source_path, #b, uploaded_at, taken_at, quality_score, blurry, dominant_colors, gps_lat, gps_lon, camera_make, camera_model, #src, sources, persons',
        ExpressionAttributeNames: { '#b': 'bytes', '#src': 'source' },
        ExclusiveStartKey,
      }),
    )
    for (const it of res.Items ?? []) {
      // interne Steuer-Items überspringen (z.B. __dropbox_cursor__, __writetest__)
      if (!it.s3_key || String(it.sha256).startsWith('__')) continue
      // RAW/Unbekanntes raus; Videos bleiben (per kind markiert)
      const kind = mediaKind(it.s3_key)
      if (!kind) continue
      const srcList: string[] = Array.isArray(it.sources) && it.sources.length ? it.sources : [it.source]
      const origins = [...new Set(srcList.map((x) => originOf(x)))]
      if (isLoose(it.source_path)) loose.add(it.sha256)
      photos.push({
        sha: it.sha256,
        s3_key: it.s3_key,
        filename: it.original_filename ?? it.s3_key,
        album: albumOf(it.source_path, it.taken_at || it.uploaded_at),
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
        origins,
        persons: it.persons ? [...it.persons].sort() : undefined,
      })
    }
    ExclusiveStartKey = res.LastEvaluatedKey
  } while (ExclusiveStartKey)

  // lose Bilder nach Aufnahmezeit zu Sessions bündeln (staubsauger#8)
  assignSessions(photos, (p) => loose.has(p.sha))
  return photos
}

export async function getAlbums(region: string, table: string, f?: Filter | null): Promise<Album[]> {
  const photos = filtered(await getAllPhotos(region, table), f)
  const map = new Map<string, Photo[]>()
  for (const p of photos) {
    const arr = map.get(p.album)
    if (arr) arr.push(p)
    else map.set(p.album, [p])
  }
  const albums: Album[] = []
  for (const [name, arr] of map) {
    if (HIDDEN_ALBUMS.has(name)) continue
    let latest = '', earliest = ''
    for (const p of arr) {
      if (p.uploaded_at > latest) latest = p.uploaded_at
      const t = takenOf(p)
      if (t && (!earliest || t < earliest)) earliest = t
    }
    // Titelbild: das schärfste/beste gelabelte Foto, sonst das zuerst aufgenommene
    let cover: Photo | undefined
    for (const p of arr) {
      if (p.kind !== 'photo') continue
      if (!cover || (p.quality_score ?? -1) > (cover.quality_score ?? -1)) cover = p
    }
    const date = earliest ? earliest.slice(0, 10) : ''
    albums.push({
      name,
      count: arr.length,
      cover: (cover ?? arr[0]).sha,
      latest,
      date,
      year: date ? Number(date.slice(0, 4)) : albumYear(name),
    })
  }
  // chronologisch: jüngstes zuerst (Aufnahmedatum), ohne Datum nach Upload-Datum ganz unten
  albums.sort((a, b) => b.year - a.year || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || (a.latest < b.latest ? 1 : -1))
  return albums
}

// Album-Inhalt in Aufnahme-Reihenfolge; ohne Aufnahmezeit nach Dateiname ans Ende
function byTaken(a: Photo, b: Photo): number {
  const ta = takenOf(a) ?? '~', tb = takenOf(b) ?? '~'
  if (ta !== tb) return ta < tb ? -1 : 1
  return a.filename < b.filename ? -1 : 1
}

export async function getAlbumPhotos(region: string, table: string, album: string, f?: Filter | null): Promise<Photo[]> {
  const photos = filtered(await getAllPhotos(region, table), f)
  return photos.filter((p) => p.album === album).sort(byTaken)
}

// ---- Timeline (nach Monat) -------------------------------------------------
// Datum = Aufnahmezeit (takenOf: EXIF taken_at oder Dropbox-Dateiname), gallery#3.
// Vorher uploaded_at: da landeten 16.012 Time-Machine-Bilder im Upload-Monat 2022-08
// und die Seite rendete einen Riesen-Grid. Nach Aufnahmezeit ist der größte Monat ~2.600.
export interface TimelineMonth {
  ym: string // Abschnitt (gallery#11): "2026-06" Monat, "2026-Q3" Quartal, "2026" Jahr, "0000-00" ohne Datum
  label: string // "Juni 2026" · "Jul – Sep 2026" · "2026"
  span: Span
  count: number
  cover: string // sha des Titelbilds (jüngstes des Monats)
}

function ymOf(p: Photo): string {
  return (takenOf(p) || '').slice(0, 7) || '0000-00'
}

// Innerhalb eines Monats: jüngste Aufnahme zuerst, dann Dateiname.
function byNewest(a: Photo, b: Photo): number {
  const ta = takenOf(a) ?? a.uploaded_at, tb = takenOf(b) ?? b.uploaded_at
  if (ta !== tb) return ta < tb ? 1 : -1
  return a.filename < b.filename ? -1 : 1
}

export async function getTimelineIndex(region: string, table: string, f?: Filter | null): Promise<TimelineMonth[]> {
  const photos = filtered(await getAllPhotos(region, table), f)
  // dünne Monate je Jahr zu Quartalen/Jahr zusammenfassen (gallery#11, Regel in buckets.ts)
  const monthCounts = new Map<string, number>()
  for (const p of photos) monthCounts.set(ymOf(p), (monthCounts.get(ymOf(p)) ?? 0) + 1)
  const plan = planSpans(monthCounts)
  const map = new Map<string, Photo[]>()
  for (const p of photos) {
    const key = bucketOf(ymOf(p), plan)
    const arr = map.get(key)
    if (arr) arr.push(p)
    else map.set(key, [p])
  }
  const months: TimelineMonth[] = []
  for (const [key, arr] of map) {
    arr.sort(byNewest)
    months.push({ ym: key, label: bucketLabel(key), span: spanOf(key), count: arr.length, cover: (arr.find((p) => p.kind === 'photo') ?? arr[0]).sha })
  }
  // neueste zuerst, Quartal/Jahr nach ihrem letzten Monat einsortiert; "Ohne Datum" (0000-00) ganz unten
  months.sort((a, b) => { const x = sortKey(a.ym), y = sortKey(b.ym); return x < y ? 1 : x > y ? -1 : 0 })
  return months
}

export interface TimelinePhoto {
  sha: string
  filename: string
  bytes: number
  uploaded_at: string
  taken_at: string | null
  kind: 'photo' | 'video'
}

export async function getTimelineMonth(region: string, table: string, key: string, f?: Filter | null): Promise<TimelinePhoto[]> {
  const photos = filtered(await getAllPhotos(region, table), f)
  return photos
    .filter((p) => inBucket(ymOf(p), key))
    .sort(byNewest)
    .map((p) => ({ sha: p.sha, filename: p.filename, bytes: p.bytes, uploaded_at: p.uploaded_at, taken_at: takenOf(p), kind: p.kind }))
}

// ---- Labels (Auto-Labeling) ------------------------------------------------
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
export async function getLabeled(region: string, table: string, f?: Filter | null): Promise<{ count: number; items: LabeledPhoto[] }> {
  const photos = filtered(await getAllPhotos(region, table), f)
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

export async function getMapPins(region: string, table: string, f?: Filter | null): Promise<{ count: number; pins: MapPin[] }> {
  const photos = filtered(await getAllPhotos(region, table), f)
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
export async function getNikonPhotos(region: string, table: string, f?: Filter | null): Promise<CameraPhoto[]> {
  const photos = filtered(await getAllPhotos(region, table), f)
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

// ---- Herkunft-Zähler (für die Filterleiste) --------------------------------
export async function getOriginCounts(region: string, table: string): Promise<Record<Origin, number> & { total: number }> {
  const photos = await getAllPhotos(region, table)
  const out = { dropbox: 0, timemachine: 0, icloud: 0, lokal: 0, total: photos.length }
  for (const p of photos) for (const o of p.origins) out[o]++
  return out
}
