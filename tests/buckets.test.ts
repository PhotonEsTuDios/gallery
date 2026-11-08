// Unit-Tests Timeline-Abschnitte (gallery#11):  node --test tests/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bucketLabel, bucketOf, inBucket, KEY_RE, planSpans, sortKey } from '../server/utils/buckets.ts'

const plan = (o: Record<string, number>) => planSpans(new Map(Object.entries(o)))

test('volle Monate bleiben Monate', () => {
  const p = plan({ '2024-04': 300, '2024-05': 20, '2024-06': 15 })
  assert.equal(bucketOf('2024-06', p), '2024-06')
})

test('ein dünner Monat fasst sein Quartal zusammen, andere Quartale bleiben Monate (Nepo 2014)', () => {
  const p = plan({ '2014-08': 188, '2014-07': 1, '2014-06': 1, '2014-12': 87, '2014-11': 20, '2014-10': 15 })
  assert.equal(bucketOf('2014-08', p), '2014-Q3')
  assert.equal(bucketOf('2014-07', p), '2014-Q3')
  assert.equal(bucketOf('2014-06', p), '2014-Q2')
  assert.equal(bucketOf('2014-12', p), '2014-12')
})

test('dünnes Jahr -> Quartale (Nepo 2026)', () => {
  const p = plan({ '2026-10': 3, '2026-09': 3, '2026-08': 18, '2026-06': 2, '2026-03': 7, '2026-01': 4 })
  assert.deepEqual(['2026-10', '2026-08', '2026-01'].map((m) => bucketOf(m, p)), ['2026-Q4', '2026-Q3', '2026-Q1'])
})

test('sehr wenige Fotos -> ganzes Jahr, Grenze 30', () => {
  assert.equal(bucketOf('2015-11', plan({ '2015-02': 4, '2015-11': 6 })), '2015')
  assert.equal(bucketOf('2020-01', plan({ '2020-01': 29 })), '2020')
  assert.equal(bucketOf('2020-01', plan({ '2020-01': 30 })), '2020-01')
  assert.equal(bucketOf('2020-01', plan({ '2020-01': 14, '2020-05': 16 })), '2020-Q1')
})

test('Sortierung: Quartal nach seinem letzten Monat, gemischt mit Monaten', () => {
  const keys = ['2023-Q1', '2023-12', '2023-Q3', '2023-05', '2022', '0000-00']
  const sorted = [...keys].sort((a, b) => (sortKey(a) < sortKey(b) ? 1 : -1))
  assert.deepEqual(sorted, ['2023-12', '2023-Q3', '2023-05', '2023-Q1', '2022', '0000-00'])
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
