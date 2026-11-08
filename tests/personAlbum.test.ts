// Unit-Tests Personen-Alben (gallery#15):  node --test tests/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ageBucket, dropBursts, portraitScore, quotas, suggest, type Candidate } from '../server/utils/personAlbum.ts'

const c = (sha: string, taken: string, o: Partial<Candidate> = {}): Candidate => ({ sha, taken, area: 0.04, score: 0.9, faces: 1, ...o })

test('Portrait-Wert: großes Gesicht allein > kleines Gesicht in der Gruppe', () => {
  assert.ok(portraitScore(c('a', '2020-01-01', { area: 0.2 })) > portraitScore(c('b', '2020-01-01', { area: 0.01, faces: 6 })))
  assert.ok(portraitScore(c('a', '2020-01-01')) > portraitScore(c('b', '2020-01-01', { blurry: true })))
})

test('Serienbilder: innerhalb 2 Min bleibt nur das beste', () => {
  const out = dropBursts([
    c('a', '2020-05-01T10:00:00Z', { area: 0.01 }), c('b', '2020-05-01T10:00:40Z', { area: 0.2 }),
    c('c', '2020-05-01T10:01:30Z', { area: 0.05 }), c('d', '2020-05-01T12:00:00Z'),
  ])
  assert.deepEqual(out.map((x) => x.sha), ['b', 'd'])
})

test('Kontingente ~ √Größe, Summe stimmt, keine Gruppe überfüllt', () => {
  const q = quotas([400, 100, 4, 1], 50)
  assert.equal(q.reduce((s, x) => s + x, 0), 50)
  assert.ok(q[0] > q[1] && q[1] > q[2] && q[2] <= 4 && q[3] <= 1)
  assert.ok(q[0] < 40) // dichte Phase dominiert nicht linear (400/505 wären 40)
  assert.deepEqual(quotas([3, 2], 100), [3, 2]) // weniger Kandidaten als n -> alle
})

// 6 Jahre, ein dichtes Jahr (2019) mit 600 Fotos, sonst je 40
function archive(): Candidate[] {
  const out: Candidate[] = []
  let i = 0
  for (const [y, n] of [[2016, 40], [2017, 40], [2018, 40], [2019, 600], [2020, 40], [2021, 40]] as const) {
    for (let k = 0; k < n; k++) {
      const m = String((k % 12) + 1).padStart(2, '0'), d = String((k % 27) + 1).padStart(2, '0')
      out.push(c(`s${i++}`, `${y}-${m}-${d}T${String(k % 24).padStart(2, '0')}:00:00Z`, { area: (k % 10) / 50 + 0.005, faces: 1 + (k % 4) }))
    }
  }
  return out
}

test('Vorschlag: 100 Stück, chronologisch, alle Jahre vertreten, dichtes Jahr nicht dominant', () => {
  const cands = archive()
  const byShas = new Map(cands.map((x) => [x.sha, x]))
  const out = suggest(cands, 100, 7)
  assert.equal(out.length, 100)
  assert.equal(new Set(out).size, 100)
  const times = out.map((s) => byShas.get(s)!.taken)
  assert.deepEqual(times, [...times].sort())
  const years = times.map((t) => t.slice(0, 4))
  for (const y of ['2016', '2017', '2018', '2019', '2020', '2021']) assert.ok(years.includes(y), y)
  assert.ok(years.filter((y) => y === '2019').length < 50)
})

test('Vorschlag bevorzugt Portraits', () => {
  const cands = archive()
  const avg = (l: Candidate[]) => l.reduce((s, x) => s + portraitScore(x), 0) / l.length
  const map = new Map(cands.map((x) => [x.sha, x]))
  const out = suggest(cands, 100, 3).map((s) => map.get(s)!)
  assert.ok(avg(out) > avg(cands) * 1.4, `${avg(out)} vs ${avg(cands)}`)
})

test('gleicher Seed = gleiche Auswahl, anderer Seed = andere', () => {
  const cands = archive()
  assert.deepEqual(suggest(cands, 100, 42), suggest(cands, 100, 42))
  const a = new Set(suggest(cands, 100, 1)), b = suggest(cands, 100, 2)
  assert.ok(b.filter((x) => !a.has(x)).length >= 8) // Pool hier nur 200 Einzelbilder (gallery#17)
})

test('ohne Datum fliegt raus, leere Eingabe ok', () => {
  assert.deepEqual(suggest([c('x', '')]), [])
  assert.deepEqual(suggest([]), [])
})


// ---- gallery#17: Entwicklung, allein, 300 ----
test('Altersstufen: 0–2 J. monatlich, 2–6 J. Quartale, danach Halbjahre', () => {
  const f = '2011-09-10T00:00:00Z'
  assert.equal(ageBucket(f, '2011-09-30'), 'a0000')
  assert.equal(ageBucket(f, '2012-08-01'), 'a0011')
  assert.equal(ageBucket(f, '2013-09-01'), 'a0024')
  assert.equal(ageBucket(f, '2013-12-01'), 'a0027')
  assert.equal(ageBucket(f, '2017-09-01'), 'a0072')
  assert.equal(ageBucket(f, '2018-02-01'), 'a0072')
  assert.equal(ageBucket(f, '2018-03-01'), 'a0078')
})

test('Allein im Bild schlägt Gruppenbild deutlich', () => {
  assert.ok(portraitScore(c('a', '2020-01-01', { area: 0.01, faces: 1 })) > portraitScore(c('b', '2020-01-01', { area: 0.3, faces: 2 })))
})

// Kind 2011–2026, jeden Monat 30 Fotos, die Hälfte mit mehreren Gesichtern
function childArchive(): Candidate[] {
  const out: Candidate[] = []
  let i = 0
  for (let y = 2011; y <= 2025; y++) for (let m = 1; m <= 12; m++) for (let k = 0; k < 30; k++) {
    out.push(c(`k${i++}`, `${y}-${String(m).padStart(2, '0')}-${String(k + 1).padStart(2, '0')}T10:00:00Z`, { faces: k % 2 ? 3 : 1, area: 0.02 + (k % 7) / 100 }))
  }
  return out
}

test('Entwicklung: 300, älteste zuerst, am Anfang dichter, nur allein', () => {
  const cands = childArchive()
  const map = new Map(cands.map((x) => [x.sha, x]))
  const out = suggest(cands, 300, 9, 'entwicklung').map((s) => map.get(s)!)
  assert.equal(out.length, 300)
  assert.ok(out.every((x, i) => i === 0 || x.taken >= out[i - 1].taken))
  assert.ok(out.every((x) => x.faces === 1), 'nur Einzelbilder, solange genug da sind')
  const perYear = (y: string) => out.filter((x) => x.taken.startsWith(y)).length
  assert.ok(perYear('2011') + perYear('2012') > 2 * (perYear('2023') + perYear('2024')), `${perYear('2011')}+${perYear('2012')} vs ${perYear('2023')}+${perYear('2024')}`)
})

test('Portraits: 300, gleichmäßiger über die Jahre', () => {
  const cands = childArchive()
  const map = new Map(cands.map((x) => [x.sha, x]))
  const out = suggest(cands, 300, 9, 'portraits').map((s) => map.get(s)!)
  assert.equal(out.length, 300)
  const perYear = (y: string) => out.filter((x) => x.taken.startsWith(y)).length
  assert.ok(Math.abs(perYear('2012') - perYear('2024')) <= 3)
})
