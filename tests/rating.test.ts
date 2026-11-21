// Unit-Tests Sterne-Bewertung (gallery#19):  node --test tests/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RATING_FIELDS, isPhotoSha, parseRating, ratingOf, ratingUpdate } from '../server/utils/rating.ts'

const SHA = 'a'.repeat(64)

test('nur 1–5 als ganze Zahl, null nimmt zurück', () => {
  for (const n of [1, 2, 3, 4, 5]) assert.equal(parseRating(n), n)
  assert.equal(parseRating(null), null)
  for (const bad of [0, 6, -1, 2.5, '3', undefined, NaN, true, {}, [4]]) assert.equal(parseRating(bad), undefined)
})

test('nur echte Foto-Einträge, keine Steuer-Einträge', () => {
  assert.ok(isPhotoSha(SHA))
  for (const bad of ['__animals__', '__faces__', '__s3import__:x', '', 'A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), undefined, 5]) assert.equal(isPhotoSha(bad), false)
})

test('Setzen schreibt genau rating + rated_at und legt nichts neu an', () => {
  const u = ratingUpdate('tabelle', SHA, 4, '2026-11-21T10:00:00.000Z')
  assert.deepEqual(u, {
    TableName: 'tabelle', Key: { sha256: SHA }, ConditionExpression: 'attribute_exists(sha256)',
    UpdateExpression: 'SET rating = :r, rated_at = :t', ExpressionAttributeValues: { ':r': 4, ':t': '2026-11-21T10:00:00.000Z' },
  })
})

test('Zurücknehmen entfernt genau diese zwei Felder', () => {
  const u = ratingUpdate('tabelle', SHA, null, 'egal')
  assert.equal(u.UpdateExpression, 'REMOVE rating, rated_at')
  assert.equal(u.ConditionExpression, 'attribute_exists(sha256)')
  assert.equal('ExpressionAttributeValues' in u, false)
})

test('kein anderes Feld kommt in einem Schreibbefehl vor', () => {
  for (const r of [1, 5, null]) {
    const expr = ratingUpdate('t', SHA, r, 'x').UpdateExpression
    const fields = expr.replace(/^(SET|REMOVE) /, '').split(',').map((s) => s.trim().split(' ')[0])
    assert.deepEqual(fields, [...RATING_FIELDS])
  }
})

test('Lesen: Bewertung aus dem Eintrag, sonst keine', () => {
  assert.deepEqual(ratingOf({ rating: 3, rated_at: '2026-11-21T10:00:00.000Z' }), { rating: 3, rated_at: '2026-11-21T10:00:00.000Z' })
  assert.deepEqual(ratingOf({}), { rating: null, rated_at: null })
  assert.deepEqual(ratingOf(undefined), { rating: null, rated_at: null })
  assert.deepEqual(ratingOf({ rating: 9 }), { rating: null, rated_at: null })
})
