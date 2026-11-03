// Unit-Tests gemeinsamer Filter (gallery#8):  node --test tests/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyFilter, colorFamily, parseFilter, personCounts, type Filterable } from '../server/utils/filter.ts'

type P = Filterable & { id: string; date: string | null }
const photos: P[] = [
  { id: 'a', origins: ['dropbox'], persons: ['Santi'], colors: ['#2050d0'], date: '2024-05-01' },
  { id: 'b', origins: ['dropbox'], persons: ['Santi', 'Nepo'], colors: ['#d02020'], date: '2024-06-01' },
  { id: 'c', origins: ['timemachine'], persons: ['Nepo'], colors: ['#2050d0'], date: '2019-01-01' },
  { id: 'd', origins: ['icloud', 'dropbox'], date: null },
]
const ids = (q: Record<string, unknown>) => applyFilter(photos, parseFilter(q), (p) => p.date).map((p) => p.id)

test('kein Filter = alles', () => {
  assert.equal(parseFilter({}), null)
  assert.deepEqual(ids({}), ['a', 'b', 'c', 'd'])
})

test('eine Person', () => assert.deepEqual(ids({ p: 'Santi' }), ['a', 'b']))

test('Personen zusammen (Standard) = alle auf einem Foto', () => {
  assert.deepEqual(ids({ p: 'Santi,Nepo' }), ['b'])
  assert.deepEqual(ids({ p: 'Santi,Nepo', pm: 'zusammen' }), ['b'])
})

test('Personen oder', () => assert.deepEqual(ids({ p: 'Santi,Nepo', pm: 'oder' }), ['a', 'b', 'c']))

test('Gruppen werden mit UND verknüpft', () => {
  assert.deepEqual(ids({ p: 'Santi', farbe: 'Blau' }), ['a'])
  assert.deepEqual(ids({ p: 'Nepo', jahr: '2019' }), ['c'])
  assert.deepEqual(ids({ jahr: '2024,2019', farbe: 'Rot' }), ['b'])
})

test('Herkunft: mehrere Quellen je Foto', () => assert.deepEqual(ids({ herkunft: 'icloud' }), ['d']))

test('Unsinn in der URL wird ignoriert', () => {
  assert.equal(parseFilter({ farbe: 'Kariert', jahr: '12', herkunft: 'ftp', p: '<script>' }), null)
  assert.deepEqual(ids({ p: ' Santi , ,Santi' }), ['a', 'b'])
})

test('Array-Parameter (?p=a&p=b) wie Komma-Liste', () => assert.deepEqual(ids({ p: ['Santi', 'Nepo'] }), ['b']))

test('Farbfamilien', () => {
  assert.equal(colorFamily('#2050d0'), 'Blau')
  assert.equal(colorFamily('#000000'), 'Schwarz')
  assert.equal(colorFamily(undefined), 'Neutral')
})

test('Personen-Zähler', () => {
  assert.deepEqual(personCounts(photos), [{ name: 'Nepo', count: 2 }, { name: 'Santi', count: 2 }])
})
