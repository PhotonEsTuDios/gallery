// Gesichter & Personen (gallery#7/#9). Lesen direkt (S3-Übersicht, DynamoDB), Schreiben NUR über
// die Lambda photon-faces (staubsauger/faces_cloud/people.py) -> eine Stelle für die Gesichterlogik.
// Biometrische Daten: nur mit Danis Login (Middleware), nie in Shares, nie in CloudFront cachen.
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda'
import { ddb, s3, streamToBuffer } from './aws'
import { rebuildIndex } from './photos'

export const SUMMARY_KEY = 'faces/clusters.json'
export const CROP_RE = /^[a-f0-9]{64}_\d{1,3}$/
const NAME_RE = /^[^<>"\\/,]{0,60}$/

export interface Cluster {
  cluster: string
  size: number
  photos: number
  person: string | null
  samples: string[] // S3-Keys faces/<sha>_<i>.jpg
}
export interface Face {
  sha: string
  face: number
  box?: number[]
  score?: number
  person?: string
  cluster?: string
  crop: string // id für /face/<id>
}

function cfg() {
  const c = useRuntimeConfig()
  return { region: c.awsRegion, bucket: c.photosBucket, table: c.photosTable, faces: c.facesTable, fn: c.facesFunction }
}

// ---- Übersicht (faces/clusters.json) ------------------------------------------------
let summary: { at: number; data: { generated_at?: string; clusters: Cluster[] } } | null = null
export async function getClusters(): Promise<{ generated_at?: string; clusters: Cluster[] }> {
  if (summary && Date.now() - summary.at < 60_000) return summary.data
  const { region, bucket } = cfg()
  try {
    const res = await s3(region).send(new GetObjectCommand({ Bucket: bucket, Key: SUMMARY_KEY }))
    const data = JSON.parse((await streamToBuffer(res.Body)).toString('utf8'))
    summary = { at: Date.now(), data }
  } catch {
    summary = { at: Date.now(), data: { clusters: [] } } // noch nicht gruppiert
  }
  return summary.data
}

/** Benannte Personen (Gruppen gleichen Namens zusammengefasst) + unbenannte Gruppen. */
export function splitClusters(clusters: Cluster[]) {
  const named = new Map<string, { person: string; clusters: string[]; size: number; photos: number; samples: string[] }>()
  const unnamed: Cluster[] = []
  for (const c of clusters) {
    if (!c.person) { unnamed.push(c); continue }
    const n = named.get(c.person) ?? { person: c.person, clusters: [], size: 0, photos: 0, samples: [] }
    n.clusters.push(c.cluster)
    n.size += c.size
    n.photos += c.photos
    if (n.samples.length < 4) n.samples.push(...c.samples.slice(0, 4 - n.samples.length))
    named.set(c.person, n)
  }
  return {
    named: [...named.values()].sort((a, b) => b.photos - a.photos),
    unnamed: unnamed.sort((a, b) => b.size - a.size),
  }
}

export function cropId(key: string): string {
  return key.replace(/^faces\//, '').replace(/\.jpg$/, '')
}

// ---- Gesichter lesen ------------------------------------------------------------------
async function queryAll(input: ConstructorParameters<typeof QueryCommand>[0], max = 2000) {
  const out: Record<string, any>[] = []
  let ExclusiveStartKey: Record<string, any> | undefined
  do {
    const r = await ddb(cfg().region).send(new QueryCommand({ ...input, ExclusiveStartKey }))
    out.push(...(r.Items ?? []))
    ExclusiveStartKey = r.LastEvaluatedKey
  } while (ExclusiveStartKey && out.length < max)
  return out
}

function toFace(it: Record<string, any>): Face {
  return {
    sha: it.sha256, face: Number(it.face),
    box: Array.isArray(it.box) ? it.box.map(Number) : undefined,
    score: it.score !== undefined ? Number(it.score) : undefined,
    person: it.person || undefined, cluster: it.cluster || undefined,
    crop: cropId(it.crop || `faces/${it.sha256}_${it.face}.jpg`),
  }
}

export async function facesOfPhoto(sha: string): Promise<Face[]> {
  const items = await queryAll({
    TableName: cfg().faces, KeyConditionExpression: 'sha256 = :s', ExpressionAttributeValues: { ':s': sha },
    ProjectionExpression: 'sha256, face, box, person, #c, crop, ignored', ExpressionAttributeNames: { '#c': 'cluster' },
  })
  return items.filter((it) => !it.ignored).map(toFace)
}

export async function facesOfCluster(cluster: string, max = 600): Promise<Face[]> {
  const items = await queryAll({
    TableName: cfg().faces, IndexName: 'cluster-index',
    KeyConditionExpression: '#c = :c', ExpressionAttributeNames: { '#c': 'cluster' }, ExpressionAttributeValues: { ':c': cluster },
  }, max)
  return items.filter((it) => !it.ignored).map((it) => toFace({ ...it, cluster }))
    .sort((a, b) => (b.box?.[2] ?? 0) - (a.box?.[2] ?? 0)) // große Gesichter zuerst
}

// ---- Schreiben über photon-faces ------------------------------------------------------
let _lambda: LambdaClient | null = null

export type FacesAction =
  | { mode: 'name'; cluster: string; person: string }
  | { mode: 'hide'; cluster: string }
  | { mode: 'reject'; sha: string; face: number }
  | { mode: 'name_face'; sha: string; face: number; person: string }
  | { mode: 'confirm'; cluster: string; person: string; wrong: FaceKey[]; shown: FaceKey[] }
  | { mode: 'reindex' } // nur Gallery: Personen-Filter neu aufbauen (nach Hintergrund-Speichern)
export interface FaceKey { sha: string; face: number }
const MAX_KEYS = 400

function faceKeys(list: unknown): FaceKey[] | null {
  if (!Array.isArray(list) || list.length > MAX_KEYS) return null
  const out: FaceKey[] = []
  for (const k of list as any[]) {
    const sha = String(k?.sha ?? ''), face = Number(k?.face)
    if (!/^[a-f0-9]{64}$/.test(sha) || !Number.isInteger(face) || face < 0 || face >= 1000) return null
    out.push({ sha, face })
  }
  return out
}

/** Prüft Eingaben aus dem Browser, bevor sie an die Lambda gehen. */
export function validateAction(body: any): FacesAction {
  const bad = (m: string) => { throw createError({ statusCode: 400, statusMessage: m }) }
  const mode = body?.mode
  const cluster = String(body?.cluster ?? '')
  const sha = String(body?.sha ?? '')
  const face = Number(body?.face)
  const person = String(body?.person ?? '').trim()
  if (!NAME_RE.test(person)) bad('Ungültiger Name')
  const okCluster = /^c\d{4,6}$/.test(cluster)
  const okFace = /^[a-f0-9]{64}$/.test(sha) && Number.isInteger(face) && face >= 0 && face < 1000
  if (mode === 'name' && okCluster) return { mode, cluster, person }
  if (mode === 'hide' && okCluster) return { mode, cluster }
  if (mode === 'reject' && okFace) return { mode, sha, face }
  if (mode === 'name_face' && okFace) return { mode, sha, face, person }
  if (mode === 'confirm' && okCluster) {
    const wrong = faceKeys(body?.wrong), shown = faceKeys(body?.shown)
    if (!person) bad('Name fehlt')
    if (wrong && shown) return { mode, cluster, person, wrong, shown }
  }
  if (mode === 'reindex') return { mode }
  return bad('Ungültige Aktion')
}

// Große Gruppen (> BIG Gesichter) brauchen in photon-faces 20–30 s -> zu nah am 30-s-Limit von CloudFront.
// Die laufen asynchron; der Personen-Filter zieht spätestens mit dem nächsten Index-Neuaufbau (≤ 30 min) nach.
const BIG = 1500

async function invoke(action: FacesAction, background = false) {
  const { region, fn } = cfg()
  _lambda ??= new LambdaClient({ region })
  const res = await _lambda.send(new InvokeCommand({
    FunctionName: fn, Payload: Buffer.from(JSON.stringify(action)), InvocationType: background ? 'Event' : 'RequestResponse',
  }))
  if (background) return { queued: true, mode: action.mode }
  const out = JSON.parse(Buffer.from(res.Payload ?? []).toString('utf8') || 'null')
  if (res.FunctionError) {
    console.warn('[faces] Fehler', action.mode, out?.errorMessage)
    throw createError({ statusCode: 502, statusMessage: 'Gesichter-Dienst: ' + (out?.errorMessage || 'Fehler') })
  }
  return out
}

/** Mehrere Aktionen (z. B. 5 falsche Gesichter raus), danach EIN Index-Neuaufbau (~5 s). */
export async function runFacesActions(actions: FacesAction[]) {
  const { region, table, bucket } = cfg()
  const sizes = new Map((await getClusters()).clusters.map((c) => [c.cluster, c.size]))
  const isBig = (a: FacesAction) => 'cluster' in a && (sizes.get(a.cluster) ?? 0) > BIG
  const results: unknown[] = []
  const work = actions.filter((a) => a.mode !== 'reindex')
  for (let i = 0; i < work.length; i += 8) {
    results.push(...(await Promise.all(work.slice(i, i + 8).map((a) => invoke(a, isBig(a))))))
  }
  summary = null // Übersicht neu lesen
  if (actions.some((a) => !isBig(a))) await rebuildIndex(region, table, bucket) // Personen-Filter sofort aktuell
  return results
}

/** Stichprobe zum Prüfen (gallery#10): Ausreißer zuerst, gerechnet in photon-faces (dort liegen die Vektoren). */
export async function sampleCluster(cluster: string, offset = 0) {
  const r = await invoke({ mode: 'sample', cluster, offset } as any)
  return {
    cluster, size: r.size as number, next: r.next as number | null,
    faces: (r.faces as any[]).map((f) => ({ sha: f.sha, face: f.face, sim: f.sim, crop: cropId(f.crop) })),
  }
}
