// Compile the shared CRA flag config into a JSON the Next app imports. Run by
// package.json predev/prebuild. Uses import.meta.url (a .mjs has no __dirname).
import fs from 'node:fs'
import yaml from 'js-yaml'

const SRC = new URL('../../webapp/config/features.yml', import.meta.url)
const OUT = new URL('../config/features.generated.json', import.meta.url)

const parsed = yaml.load(fs.readFileSync(SRC, 'utf8')) || {}
const json = JSON.stringify(parsed, null, 2) + '\n'

let current = null
try { current = fs.readFileSync(OUT, 'utf8') } catch { /* first run */ }
if (current === json) {
  console.log('[gen-features] up to date')
} else {
  fs.mkdirSync(new URL('../config/', import.meta.url), { recursive: true })
  fs.writeFileSync(OUT, json)
  console.log('[gen-features] wrote config/features.generated.json')
}
