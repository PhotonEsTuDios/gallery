import { GetObjectCommand } from '@aws-sdk/client-s3'
import { s3, streamToBuffer } from '../utils/aws'

// Fortschritt der Raw-Importe (staubsauger/raw_import_cloud/driver.py schreibt
// raw/<name>/_import/progress.json). Neue Importe hier eintragen.
const IMPORTS = ['timemachine-2024-12-14']

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  setHeader(event, 'cache-control', 'private, no-store')
  const client = s3(cfg.awsRegion)
  const out = []
  for (const name of IMPORTS) {
    try {
      const obj = await client.send(new GetObjectCommand({ Bucket: cfg.photosBucket, Key: `raw/${name}/_import/progress.json` }))
      out.push(JSON.parse((await streamToBuffer(obj.Body)).toString('utf8')))
    } catch {
      out.push({ name, state: 'noch nicht gestartet' })
    }
  }
  return out
})
