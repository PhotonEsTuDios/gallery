import { GetObjectCommand } from '@aws-sdk/client-s3'
import { GetCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, s3, streamToBuffer } from '../utils/aws'

// Fortschritt der Importe aus dem S3-Rohspiegel.
//  - neu: Lambda photon-s3importer zählt in DynamoDB (sha256 = "__s3import__:<name>")
//  - alt: Mac-Treiber schrieb raw/<name>/_import/progress.json (Fallback)
const IMPORTS = ['timemachine-2024-12-14']

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  setHeader(event, 'cache-control', 'private, no-store')
  const out = []
  for (const name of IMPORTS) {
    const r = await ddb(cfg.awsRegion).send(new GetCommand({ TableName: cfg.photosTable, Key: { sha256: `__s3import__:${name}` } }))
    const it = r.Item
    if (it) {
      const n = (k: string) => Number(it[k] ?? 0)
      const doneFiles = n('already_files') + n('done_files')
      const doneBytes = n('already_bytes') + n('done_bytes')
      const finished = n('packages') > 0 && n('packages_done') >= n('packages')
      const secs = (Date.parse(it.updated_at) - Date.parse(it.planned_at)) / 1000
      const rate = secs > 0 ? n('done_bytes') / secs : 0
      out.push({
        name,
        source: it.source,
        state: finished ? 'fertig' : 'läuft',
        updated_at: it.updated_at,
        started_at: it.planned_at,
        total_files: n('total_files'),
        done_files: doneFiles + n('err'),
        total_bytes: n('total_bytes'),
        done_bytes: doneBytes,
        percent: n('total_bytes') ? Math.round((1000 * doneBytes) / n('total_bytes')) / 10 : 100,
        counts: { new: n('new'), dup: n('dup'), skip: n('skip'), err: n('err') },
        rate_mb_s: Math.round(rate / 1e5) / 10,
        eta_h: rate > 0 && !finished ? (n('total_bytes') - doneBytes) / rate / 3600 : null,
        batches: n('packages_done'),
        current: `Lambda photon-s3importer · Pakete ${n('packages_done')} / ${n('packages')} · vorher schon erledigt ${n('already_files').toLocaleString('de-DE')} Dateien`,
      })
      continue
    }
    try {
      const obj = await s3(cfg.awsRegion).send(new GetObjectCommand({ Bucket: cfg.photosBucket, Key: `raw/${name}/_import/progress.json` }))
      out.push(JSON.parse((await streamToBuffer(obj.Body)).toString('utf8')))
    } catch {
      out.push({ name, state: 'noch nicht gestartet' })
    }
  }
  return out
})
