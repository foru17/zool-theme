#!/usr/bin/env node
// Checks that every locale has the same keys and placeholders as en.json, and that
// every static t('…') key used in src/ exists. Plural suffixes (_one, _other…) are
// folded together because languages differ in how many forms they need.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const dir = join(root, 'src/i18n/locales')
const PLURAL = /_(zero|one|two|few|many|other)$/

function flatten(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') flatten(v, key, out)
    else out.set(key, String(v))
  }
  return out
}

const fold = (map) => {
  const out = new Map()
  for (const [k, v] of map) {
    const base = k.replace(PLURAL, '')
    const vars = new Set([...v.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).filter((n) => n !== 'count'))
    const tags = new Set([...v.matchAll(/<(\w+)>/g)].map((m) => m[1]))
    out.set(base, { vars, tags })
  }
  return out
}

const load = (file) => fold(flatten(JSON.parse(readFileSync(join(dir, file), 'utf8'))))
const en = load('en.json')
let failed = false
const fail = (msg) => {
  failed = true
  console.error(`✗ ${msg}`)
}

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'en.json')) {
  const loc = load(file)
  for (const key of en.keys()) if (!loc.has(key)) fail(`${file}: missing ${key}`)
  for (const key of loc.keys()) if (!en.has(key)) fail(`${file}: extra ${key}`)
  for (const [key, { vars, tags }] of en) {
    const other = loc.get(key)
    if (!other) continue
    for (const v of vars) if (!other.vars.has(v)) fail(`${file}: ${key} lacks {{${v}}}`)
    for (const tag of tags) if (!other.tags.has(tag)) fail(`${file}: ${key} lacks <${tag}>`)
  }
}

function walk(d, out = []) {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|jsx?)$/.test(f)) out.push(p)
  }
  return out
}

for (const file of walk(join(root, 'src'))) {
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g)) {
    if (!en.has(m[1].replace(PLURAL, ''))) fail(`${file.replace(root, '')}: unknown key ${m[1]}`)
  }
  for (const m of src.matchAll(/i18nKey="([a-zA-Z0-9_.]+)"/g)) {
    if (!en.has(m[1])) fail(`${file.replace(root, '')}: unknown key ${m[1]}`)
  }
}

if (failed) process.exit(1)
console.log(`✓ i18n: ${en.size} keys consistent across ${readdirSync(dir).length} locales`)
