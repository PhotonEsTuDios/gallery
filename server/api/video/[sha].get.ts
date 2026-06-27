import { GetObjectCommand } from '@aws-sdk/client-s3'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { ddb, s3 } from '../../utils/aws'

// Liefert eine zeitlich begrenzte presigned S3-URL fuers Video — der Browser
// streamt damit direkt aus S3 (Range/Spulen nativ), NICHT durchs Lambda
// (Videos sind teils GB-gross).
export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  const sha = getRouterParam(event, 'sha') || ''
  if (!/^[a-f0-9]{64}$/.test(sha)) throw createError({ statusCode: 400, statusMessage: 'Ungültige sha' })

  const res = await ddb(cfg.awsRegion).send(
    new GetCommand({ TableName: cfg.photosTable, Key: { sha256: sha }, ProjectionExpression: 's3_key' }),
  )
  const key = res.Item?.s3_key as string | undefined
  if (!key) throw createError({ statusCode: 404, statusMessage: 'Nicht gefunden' })

  const ext = key.toLowerCase().split('.').pop()
  const contentType = ext === 'mov' ? 'video/quicktime' : 'video/mp4'
  const url = await getSignedUrl(
    s3(cfg.awsRegion),
    new GetObjectCommand({ Bucket: cfg.photosBucket, Key: key, ResponseContentType: contentType }),
    { expiresIn: 3600 },
  )
  return { url, contentType }
})
