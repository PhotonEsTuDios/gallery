// Unit-Tests Fortschritt der Erkennungs-Läufe (gallery#21):  node --test tests/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runProgress } from '../server/utils/runs.ts'

test('kein Eintrag = noch nicht gelaufen', () => {
  const p = runProgress(undefined)
  assert.equal(p.state, 'noch nicht gelaufen')
  assert.equal(p.percent, 0)
  assert.equal(p.updated_at, null)
})

test('mitten im Lauf', () => {
  const p = runProgress({ done: 400, err: 100, total: 2000, faces: 37, packages_done: 20, packages: 80, planned_at: 'a', updated_at: 'b' })
  assert.equal(p.state, 'läuft')
  assert.deepEqual([p.done, p.total, p.found, p.err, p.percent], [500, 2000, 37, 100, 25])
  assert.deepEqual([p.packages_done, p.packages, p.planned_at, p.updated_at], [20, 80, 'a', 'b'])
})

test('fertig erst, wenn alles bearbeitet ist (kein Aufrunden auf 100 %)', () => {
  assert.equal(runProgress({ done: 1999, err: 0, total: 2000 }).percent, 99.9)
  assert.equal(runProgress({ done: 1999, err: 0, total: 2000 }).state, 'läuft')
  const p = runProgress({ done: 1990, err: 10, total: 2000, packages_done: 80, packages: 80 })
  assert.deepEqual([p.state, p.percent, p.done], ['fertig', 100, 2000])
})

test('letzter Plan ohne neue Fotos = fertig, 0 von 0', () => {
  const p = runProgress({ done: 0, err: 0, total: 0, faces: 0, packages_done: 0, packages: 0, updated_at: 'x' })
  assert.deepEqual([p.state, p.total, p.percent], ['fertig', 0, 100])
})

test('Zahlen aus DynamoDB können als Text kommen', () => {
  const p = runProgress({ done: '5', err: '0', total: '10', faces: '2' })
  assert.deepEqual([p.done, p.total, p.found, p.percent], [5, 10, 2, 50])
})
