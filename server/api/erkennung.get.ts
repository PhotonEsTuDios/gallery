import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { ddb } from '../utils/aws'
import { RUNS, runProgress } from '../utils/runs'

// Fortschritt der Tier- und Gesichtserkennung für die Import-Seite (gallery#21). Nur lesen.
export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  setHeader(event, 'cache-control', 'private, no-store')
  return await Promise.all(RUNS.map(async ({ key, label, found_label, item }) => {
    const r = await ddb(cfg.awsRegion).send(new GetCommand({ TableName: cfg.photosTable, Key: { sha256: item } }))
    return { key, label, found_label, ...runProgress(r.Item) }
  }))
})
