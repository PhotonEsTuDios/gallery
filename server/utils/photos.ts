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

// Album = der unmittelbare Ordner, in dem das Bild liegt.
// "/Kamera-Uploads/Julie 2014/foo.jpg" -> "Julie 2014"
function albumFromPath(sourcePath: string | undefined): string {
  if (!sourcePath) return 'Sonstige'
  const parts = sourcePath.split('/').filter(Boolean)
  if (parts.length < 2) return 'Sonstige'
  return parts[parts.length - 2]
}

// Ordner, die keine echten Shootings sind und nicht in der Galerie auftauchen.
const HIDDEN_ALBUMS = new Set(['Claude-Workspace', 'Kamera-Uploads', 'Sonstige'])

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
      photos.push({
        sha: it.sha256,
        s3_key: it.s3_key,
        filename: it.original_filename ?? it.s3_key,
        album: albumFromPath(it.source_path),
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
