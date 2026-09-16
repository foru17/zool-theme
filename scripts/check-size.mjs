#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const limit = Number(process.env.ZOOL_SIZE_LIMIT ?? 131072)

try {
  if (!Number.isSafeInteger(limit) || limit < 0 || process.env.ZOOL_SIZE_LIMIT?.trim() === '') {
    throw new Error('ZOOL_SIZE_LIMIT must be a non-negative integer (bytes)')
  }

  for (const target of ['komari', 'nezha']) {
    const dist = new URL(`../dist/${target}/`, import.meta.url)
    const html = readFileSync(new URL('index.html', dist), 'utf8')
    // Follow script references in index.html; stale assets must not affect the gate.
    const entries = new Set()
    for (const script of html.matchAll(/<script\b[^>]*>/gi)) {
      const src = script[0].match(/\ssrc\s*=\s*(["'])(.*?)\1/i)
      const entry = src?.[2].match(/^(?:\/|\.\/)?assets\/(index-[^/?#]+\.js)(?:[?#].*)?$/)
      if (entry) entries.add(entry[1])
    }
    if (entries.size !== 1) {
      throw new Error(`${target}: expected one index-*.js script in dist/${target}/index.html, found ${entries.size}`)
    }
    const [entry] = entries
    const bytes = gzipSync(readFileSync(new URL(`assets/${entry}`, dist)), { level: 6 }).length
    console.log(`${target}: ${bytes} bytes gzip-6 (limit: ${limit} bytes) — ${entry}`)
    if (bytes > limit) {
      console.error(`${target}: exceeds gzip-6 size limit by ${bytes - limit} bytes`)
      process.exitCode = 1
    }
  }
} catch (error) {
  console.error(`Size check failed: ${error.message}`)
  process.exitCode = 1
}
