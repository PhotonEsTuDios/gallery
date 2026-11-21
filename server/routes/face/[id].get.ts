import { GetObjectCommand } from '@aws-sdk/client-s3'
import { s3, streamToBuffer } from '../../utils/aws'
import { CROP_RE, PREFIX, kindOf } from '../../utils/faces'

// Gesichts-Ausschnitt faces/<sha>_<i>.jpg (gallery#7), mit ?art=tiere animals/<sha>_<i>.jpg (gallery#18).
// Nur mit Login (Middleware), nur privat cachen.
export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  const id = (getRouterParam(event, 'id') || '').replace(/\.jpg$/, '')
  if (!CROP_RE.test(id)) throw createError({ statusCode: 400, statusMessage: 'Ungültige ID' })
  try {
    const obj = await s3(cfg.awsRegion).send(new GetObjectCommand({ Bucket: cfg.photosBucket, Key: `${PREFIX[kindOf(event)]}/${id}.jpg` }))
    setHeader(event, 'Content-Type', 'image/jpeg')
    setHeader(event, 'Cache-Control', 'private, max-age=86400')
    return await streamToBuffer(obj.Body)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Kein Ausschnitt' })
  }
})
