import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import type { H3Event } from 'h3'
import { s3, streamToBuffer } from './aws'

// Danielas Portfolio-Auswahl fürs Online-Auftreten: je Foto eine von vier Säulen.
// Liegt als eine JSON-Datei in s3://<bucket>/portfolio/picks.json. Schreiben mit
// ETag-Bedingung (If-Match / If-None-Match), damit schnelle Klicks sich nicht überschreiben.

export const PILLARS = ['seen', 'light', 'eye', 'archive'] as const
export type Pillar = (typeof PILLARS)[number]
export type Pick = { pillar: Pillar; filename: string; kind?: 'photo' | 'video'; at: string }
export type Picks = Record<string, Pick>

const KEY = 'portfolio/picks.json'

function env(event: H3Event) {
  const cfg = useRuntimeConfig(event)
  return { region: cfg.awsRegion as string, bucket: cfg.photosBucket as string }
}

async function read(event: H3Event): Promise<{ picks: Picks; etag: string | null }> {
  const { region, bucket } = env(event)
  try {
    const obj = await s3(region).send(new GetObjectCommand({ Bucket: bucket, Key: KEY }))
    return { picks: JSON.parse((await streamToBuffer(obj.Body)).toString('utf8')), etag: obj.ETag ?? null }
  } catch {
    // Noch keine Datei (ohne ListBucket kommt 403 statt 404). Beim Schreiben schützt
    // If-None-Match davor, eine vorhandene Datei bei einem Lesefehler zu überschreiben.
    return { picks: {}, etag: null }
  }
}

export async function getPicks(event: H3Event): Promise<Picks> {
  return (await read(event)).picks
}

export async function setPick(event: H3Event, sha: string, pick: Omit<Pick, 'at'> | null): Promise<Picks> {
  const { region, bucket } = env(event)
  for (let attempt = 0; attempt < 4; attempt++) {
    const { picks, etag } = await read(event)
    if (pick) picks[sha] = { ...pick, at: new Date().toISOString() }
    else delete picks[sha]
    try {
      await s3(region).send(new PutObjectCommand({
        Bucket: bucket, Key: KEY, Body: JSON.stringify(picks), ContentType: 'application/json',
        ...(etag ? { IfMatch: etag } : { IfNoneMatch: '*' }),
      }))
      return picks
    } catch (e: any) {
      const status = e?.$metadata?.httpStatusCode
      if (status !== 412 && status !== 409) throw e
    }
  }
  throw createError({ statusCode: 409, statusMessage: 'Auswahl wurde gleichzeitig geändert – bitte nochmal' })
}
