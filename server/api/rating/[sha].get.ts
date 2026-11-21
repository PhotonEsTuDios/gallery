import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { ddb } from '../../utils/aws'
import { isPhotoSha, ratingOf } from '../../utils/rating'

// Sterne eines Fotos (gallery#19): { sha, rating: 1–5 | null, rated_at }
export default defineEventHandler(async (event) => {
  const sha = getRouterParam(event, 'sha')
  if (!isPhotoSha(sha)) throw createError({ statusCode: 400, statusMessage: 'sha fehlt' })
  const cfg = useRuntimeConfig(event)
  setHeader(event, 'cache-control', 'private, no-store')
  const r = await ddb(cfg.awsRegion).send(new GetCommand({
    TableName: cfg.photosTable, Key: { sha256: sha }, ProjectionExpression: 'rating, rated_at',
  }))
  return { sha, ...ratingOf(r.Item) }
})
