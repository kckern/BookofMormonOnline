// scripts/test/bom-secrets-ensure-units.test.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'ops', 'homeserver')
const service = readFileSync(join(dir, 'bom-secrets-ensure.service'), 'utf8')
const timer = readFileSync(join(dir, 'bom-secrets-ensure.timer'), 'utf8')
const key = (src, k) => [...src.matchAll(new RegExp(`^${k}=(.*)$`, 'gm'))].map((m) => m[1].trim())

test('service is a oneshot that runs the push script in ensure mode', () => {
  assert.deepEqual(key(service, 'Type'), ['oneshot'])
  assert.deepEqual(key(service, 'ExecStart'), ['%h/BookofMormonOnline/scripts/bom-secrets-push.sh ensure'])
})

test('service timeout covers ssh timeout 1800 plus the push', () => {
  const t = key(service, 'TimeoutStartSec'); assert.equal(t.length, 1)
  assert.match(t[0], /^\d+$/); assert.ok(Number(t[0]) >= 2100, t[0])
})

test('timer fires after boot and every 5 minutes', () => {
  assert.equal(key(timer, 'OnBootSec').length, 1)
  assert.deepEqual(key(timer, 'OnUnitActiveSec'), ['5min'])
  assert.deepEqual(key(timer, 'WantedBy'), ['timers.target'])
})
