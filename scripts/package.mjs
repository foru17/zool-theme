#!/usr/bin/env node
// Packs the built themes into release/:
//   zool-komari-v<version>.zip  → upload in Komari admin (Settings → Theme), or unzip into data/theme/zool-theme/
//   zool-nezha-v<version>.zip   → unzip and mount over a Nezha template directory (see docs/install-nezha.md)
// Run `pnpm build` first.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const out = join(root, 'release')
const stage = join(out, '.stage')

function assertBuilt(dir) {
  if (!existsSync(join(dir, 'index.html'))) {
    console.error(`✗ ${dir} is missing, run \`pnpm build\` first`)
    process.exit(1)
  }
  const maps = walk(dir).filter((f) => f.endsWith('.map'))
  if (maps.length) {
    console.error(`✗ source maps found in ${dir}: ${maps.join(', ')}`)
    process.exit(1)
  }
}

function walk(d, acc = []) {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p, acc)
    else acc.push(p)
  }
  return acc
}

function zip(cwd, name, entries) {
  const file = join(out, name)
  rmSync(file, { force: true })
  execFileSync('zip', ['-r', '-X', '-q', file, ...entries], { cwd })
  const sha = createHash('sha256').update(readFileSync(file)).digest('hex')
  const size = (statSync(file).size / 1024).toFixed(0)
  console.log(`✓ ${name}  ${size} KB  sha256 ${sha}`)
  return { name, sha, size }
}

rmSync(stage, { recursive: true, force: true })
mkdirSync(stage, { recursive: true })

// Komari: komari-theme.json + preview.png + dist/ at the zip root.
const komariDist = join(root, 'dist/komari')
assertBuilt(komariDist)
const k = join(stage, 'komari')
mkdirSync(k)
const manifest = JSON.parse(readFileSync(join(root, 'targets/komari/komari-theme.json'), 'utf8'))
manifest.version = pkg.version
writeFileSync(join(k, 'komari-theme.json'), `${JSON.stringify(manifest, null, 2)}\n`)
const preview = join(root, 'docs/screenshots/preview.png')
if (existsSync(preview)) cpSync(preview, join(k, 'preview.png'))
else console.warn('! docs/screenshots/preview.png not found, packing without preview')
cpSync(komariDist, join(k, 'dist'), { recursive: true })

// Nezha: a single folder that replaces a user template directory.
const nezhaDist = join(root, 'dist/nezha')
assertBuilt(nezhaDist)
const n = join(stage, 'nezha')
cpSync(nezhaDist, join(n, 'zool-dist'), { recursive: true })

const results = [
  zip(k, `zool-komari-v${pkg.version}.zip`, readdirSync(k)),
  zip(n, `zool-nezha-v${pkg.version}.zip`, ['zool-dist']),
]
writeFileSync(join(out, 'SHA256SUMS'), results.map((r) => `${r.sha}  ${r.name}`).join('\n') + '\n')
rmSync(stage, { recursive: true, force: true })
