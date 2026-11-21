import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb } from '../../utils/aws'
import { isPhotoSha, parseRating, ratingUpdate } from '../../utils/rating'

// Foto bewerten (gallery#19). Body: { rating: 1–5 } oder { rating: null } = zurücknehmen.
// Schreibt am Foto-Eintrag nur rating + rated_at, nichts sonst.
export default defineEventHandler(async (event) => {
  const sha = getRouterParam(event, 'sha')
  if (!isPhotoSha(sha)) throw createError({ statusCode: 400, statusMessage: 'sha fehlt' })
  const rating = parseRating((await readBody<Record<string, unknown>>(event))?.rating)
  if (rating === undefined) throw createError({ statusCode: 400, statusMessage: 'Bewertung muss 1–5 sein' })
  const cfg = useRuntimeConfig(event)
  const rated_at = new Date().toISOString()
  try {
    await ddb(cfg.awsRegion).send(new UpdateCommand(ratingUpdate(cfg.photosTable, sha, rating, rated_at)))
  } catch (e: any) {
    if (e?.name === 'ConditionalCheckFailedException') throw createError({ statusCode: 404, statusMessage: 'Foto nicht gefunden' })
    console.error('rating', e?.name, e?.message)
    throw createError({ statusCode: 502, statusMessage: 'Bewertung nicht gespeichert' })
  }
  setHeader(event, 'cache-control', 'private, no-store')
  return { sha, rating, rated_at: rating === null ? null : rated_at }
})
