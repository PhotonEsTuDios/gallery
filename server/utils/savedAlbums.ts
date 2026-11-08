// Gespeicherte Alben (gallery#15), z. B. aus Personen-Vorschlägen. Eine JSON-Datei
// s3://<bucket>/albums/saved.json, Schreiben mit ETag-Bedingung wie beim Portfolio.
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import type { H3Event } from 'h3'
import { s3, streamToBuffer } from './aws'

export interface SavedAlbum { name: string; person?: string; created_at: string; shas: string[] }
const KEY = 'albums/saved.json'
export const ALBUM_NAME_RE = /^[^<>"\\/]{1,80}$/
export const MAX_SHAS = 500

function env(event: H3Event) {
  const cfg = useRuntimeConfig(event)
  return { region: cfg.awsRegion as string, bucket: cfg.photosBucket as string }
}

async function read(event: H3Event): Promise<{ albums: SavedAlbum[]; etag: string | null }> {
  const { region, bucket } = env(event)
  try {
    const obj = await s3(region).send(new GetObjectCommand({ Bucket: bucket, Key: KEY }))
    return { albums: JSON.parse((await streamToBuffer(obj.Body)).toString('utf8')).albums ?? [], etag: obj.ETag ?? null }
  } catch {
    return { albums: [], etag: null } // noch keine Datei
  }
}

export async function getSavedAlbums(event: H3Event): Promise<SavedAlbum[]> {
  return (await read(event)).albums
}

/** change(albums) -> neue Liste; mit ETag-Wiederholung gegen gleichzeitiges Schreiben. */
export async function updateSavedAlbums(event: H3Event, change: (albums: SavedAlbum[]) => SavedAlbum[]): Promise<SavedAlbum[]> {
  const { region, bucket } = env(event)
  for (let attempt = 0; attempt < 4; attempt++) {
    const { albums, etag } = await read(event)
    const next = change(albums)
    try {
      await s3(region).send(new PutObjectCommand({
        Bucket: bucket, Key: KEY, Body: JSON.stringify({ albums: next }), ContentType: 'application/json',
        ...(etag ? { IfMatch: etag } : { IfNoneMatch: '*' }),
      }))
      return next
    } catch (e: any) {
      const status = e?.$metadata?.httpStatusCode
      if (status !== 412 && status !== 409) throw e
    }
  }
  throw createError({ statusCode: 409, statusMessage: 'Gleichzeitig geändert – bitte nochmal' })
}
