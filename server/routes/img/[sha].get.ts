import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import sharp from 'sharp'
import { ddb, s3, streamToBuffer } from '../../utils/aws'

const ALLOWED_WIDTHS = [200, 400, 800, 1600]
const SHA_RE = /^[a-f0-9]{64}$/

// holt das Original-Objekt (S3-Key + Dateiname) aus DynamoDB
async function originalMeta(region: string, table: string, sha: string) {
  const res = await ddb(region).send(new GetCommand({ TableName: table, Key: { sha256: sha } }))
  if (!res.Item?.s3_key) throw createError({ statusCode: 404, statusMessage: 'Unbekanntes Bild' })
  return { key: res.Item.s3_key as string, filename: (res.Item.original_filename as string) || res.Item.s3_key }
}

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  const sha = (getRouterParam(event, 'sha') || '').replace(/\.(webp|jpg|jpeg|png)$/i, '')
  if (!SHA_RE.test(sha)) throw createError({ statusCode: 400, statusMessage: 'Ungültige ID' })

  const q = getQuery(event)
  const region = cfg.awsRegion
  const bucket = cfg.photosBucket
  const client = s3(region)

  // --- Original-Download (Volle Auflösung) ---
  if (q.dl !== undefined || q.full !== undefined) {
    const meta = await originalMeta(region, cfg.photosTable, sha)
    const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: meta.key }))
    const buf = await streamToBuffer(obj.Body)
    setHeader(event, 'Content-Type', obj.ContentType || 'application/octet-stream')
    setHeader(event, 'Cache-Control', 'private, max-age=3600')
    if (q.dl !== undefined) {
      setHeader(event, 'Content-Disposition', `attachment; filename="${meta.filename.replace(/"/g, '')}"`)
    }
    return buf
  }

  // --- Thumbnail ---
  let w = Number(q.w) || 400
  if (!ALLOWED_WIDTHS.includes(w)) w = 400
  const thumbKey = `thumbs/${sha}_${w}.webp`

  const sendWebp = (buf: Buffer) => {
    setHeader(event, 'Content-Type', 'image/webp')
    setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
    return buf
  }

  // 1) persistenter S3-Cache
  // Cache-Miss darf NIE 500 werfen: ohne s3:ListBucket maskiert S3 ein fehlendes
  // Objekt als 403 statt 404 -> in JEDEM Fehlerfall einfach zur Generierung
  // durchfallen (ein echter Lese-/Infra-Fehler taucht dann unten klar auf).
  try {
    const cached = await client.send(new GetObjectCommand({ Bucket: bucket, Key: thumbKey }))
    return sendWebp(await streamToBuffer(cached.Body))
  } catch {
    // weiter zur Generierung
  }

  // 2) Original holen, resizen, in S3 ablegen
  const meta = await originalMeta(region, cfg.photosTable, sha)
  let origBuf: Buffer
  try {
    const orig = await client.send(new GetObjectCommand({ Bucket: bucket, Key: meta.key }))
    origBuf = await streamToBuffer(orig.Body)
  } catch (e: any) {
    // Original liegt nicht vor oder ist nicht lesbar (z.B. fehlendes s3:GetObject-Recht
    // der Exec-Rolle) -> klar als 502 melden, nicht als generisches 500.
    throw createError({ statusCode: 502, statusMessage: `Original nicht lesbar (${e?.name || 'Fehler'})` })
  }
  let thumb: Buffer
  try {
    thumb = await sharp(origBuf)
      .rotate() // EXIF-Orientierung respektieren
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
  } catch {
    // nicht rendertbares Format (z.B. RAW) -> sauber 415 statt 500
    throw createError({ statusCode: 415, statusMessage: 'Format nicht renderbar' })
  }

  // write-through in den S3-Cache (Fehler hier dürfen das Ausliefern nicht killen)
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: thumbKey,
        Body: thumb,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
  } catch {
    // ignorieren – Bild wird trotzdem ausgeliefert
  }

  return sendWebp(thumb)
})
