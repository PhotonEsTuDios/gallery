// Unit-Tests Timeline-Abschnitte (gallery#11):  node --test tests/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bucketLabel, bucketOf, inBucket, KEY_RE, planSpans } from '../server/utils/buckets.ts'

const plan = (o: Record<string, number>) => planSpans(new Map(Object.entries(o)))

test('volle Monate bleiben Monate', () => {
  const p = plan({ '2024-05': 300, '2024-06': 20, '2024-07': 2 })
  assert.equal(p.get('2024'), 'month')
  assert.equal(bucketOf('2024-07', p), '2024-07')
})

test('dünnes Jahr mit genug Fotos -> Quartale (Nepo 2026)', () => {
  const p = plan({ '2026-10': 3, '2026-09': 3, '2026-08': 18, '2026-06': 2, '2026-03': 7, '2026-01': 4 })
  assert.equal(p.get('2026'), 'quarter')
  assert.equal(bucketOf('2026-08', p), '2026-Q3')
  assert.equal(bucketOf('2026-10', p), '2026-Q4')
  assert.equal(bucketOf('2026-01', p), '2026-Q1')
})

test('sehr wenige Fotos -> ganzes Jahr', () => {
  const p = plan({ '2015-02': 4, '2015-11': 6 })
  assert.equal(p.get('2015'), 'year')
  assert.equal(bucketOf('2015-11', p), '2015')
})

test('Grenzen: 30 Fotos sind kein Jahres-Abschnitt mehr, Ø 15 ist Monat', () => {
  assert.equal(plan({ '2020-01': 29 }).get('2020'), 'year')
  assert.equal(plan({ '2020-01': 15, '2020-02': 15 }).get('2020'), 'month')
  assert.equal(plan({ '2020-01': 16, '2020-02': 14, '2020-03': 1 }).get('2020'), 'quarter')
})

test('ohne Datum bleibt eigener Abschnitt', () => {
  const p = plan({ '0000-00': 5 })
  assert.equal(bucketOf('0000-00', p), '0000-00')
  assert.equal(p.size, 0)
})

test('inBucket passt zu bucketOf', () => {
  assert.ok(inBucket('2026-08', '2026-Q3') && inBucket('2026-07', '2026-Q3') && inBucket('2026-09', '2026-Q3'))
  assert.ok(!inBucket('2026-10', '2026-Q3') && !inBucket('2025-08', '2026-Q3'))
  assert.ok(inBucket('2015-11', '2015') && !inBucket('0000-00', '2015'))
  assert.ok(inBucket('2024-07', '2024-07') && !inBucket('2024-08', '2024-07'))
  assert.ok(inBucket('0000-00', '0000-00'))
})

test('Schlüssel-Prüfung und Beschriftung', () => {
  for (const k of ['2026', '2026-08', '2026-Q3', '0000-00']) assert.ok(KEY_RE.test(k), k)
  for (const k of ['2026-13', '2026-Q5', '26', '2026-08-01', '../x']) assert.ok(!KEY_RE.test(k), k)
  assert.equal(bucketLabel('2026-Q3'), 'Jul – Sep 2026')
  assert.equal(bucketLabel('2026'), '2026')
  assert.equal(bucketLabel('2026-08'), 'August 2026')
  assert.equal(bucketLabel('0000-00'), 'Ohne Datum')
})
