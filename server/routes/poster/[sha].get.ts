import { GetObjectCommand } from '@aws-sdk/client-s3'
import { s3, streamToBuffer } from '../../utils/aws'

// Liefert das vorab generierte Video-Poster (thumbs/<sha>_poster.jpg) aus S3.
// 404, solange der video_poster.py-Lauf das Video noch nicht erfasst hat
// -> die Kachel faellt dann auf den ▶-Platzhalter zurueck.
export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  const sha = (getRouterParam(event, 'sha') || '').replace(/\.jpg$/, '')
  if (!/^[a-f0-9]{64}$/.test(sha)) throw createError({ statusCode: 400, statusMessage: 'Ungültige sha' })
  try {
    const obj = await s3(cfg.awsRegion).send(
      new GetObjectCommand({ Bucket: cfg.photosBucket, Key: `thumbs/${sha}_poster.jpg` }),
    )
    setHeader(event, 'content-type', 'image/jpeg')
    setHeader(event, 'cache-control', 'public, max-age=31536000, immutable')
    return await streamToBuffer(obj.Body)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Kein Poster' })
  }
})
