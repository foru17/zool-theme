/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

type Target = 'komari' | 'nezha' | 'demo'

/**
 * Dev server upstream, e.g. `.env.komari.local` → `ZOOL_UPSTREAM=https://komari.example.com`.
 * Without one, `pnpm dev` / `pnpm dev:nezha` fall back to demo data.
 */

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}
const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url))

/**
 * Nezha ships a `config.js` next to index.html (same idea as Nazhua), so site owners
 * can tweak the theme without rebuilding. Komari reads settings from /api/public instead.
 */
function nezhaRuntimeConfig(target: Target): Plugin {
  const file = fileURLToPath(new URL('./targets/nezha/config.js', import.meta.url))
  return {
    name: 'zool:nezha-config',
    transformIndexHtml(html) {
      if (target !== 'nezha') return html
      // Komari rewrites these two strings server-side; Nezha serves the file as-is.
      return html
        .replace('<title>Komari Monitor</title>', '<title>Status</title>')
        .replace('<meta name="description" content="A simple server monitor tool." />', '<meta name="description" content="Server status" />')
        .replace('<!-- zool:runtime-config -->', '<script src="/config.js"></script>')
    },
    configureServer(server) {
      if (target !== 'nezha') return
      server.middlewares.use('/config.js', (_req, res) => {
        res.setHeader('content-type', 'text/javascript')
        res.end(readFileSync(file, 'utf8'))
      })
    },
    generateBundle() {
      if (target !== 'nezha') return
      this.emitFile({ type: 'asset', fileName: 'config.js', source: readFileSync(file, 'utf8') })
    },
  }
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), 'ZOOL_')
  const upstream = mode === 'demo' ? '' : (env.ZOOL_UPSTREAM ?? '')
  const requested: Target = mode === 'nezha' || mode === 'demo' ? mode : 'komari'
  // Builds always target the real backend; only the dev server swaps in demo data.
  const target: Target = command === 'serve' && !upstream ? 'demo' : requested
  const outDir = requested

  const proxied = (path: string) => ({
    [path]: {
      target: upstream,
      changeOrigin: true,
      ws: true,
      secure: true,
      // Both backends check the Origin of WebSocket upgrades.
      headers: { Origin: upstream, Referer: `${upstream}/` },
    },
  })

  return {
    base: '/',
    plugins: [
      react(),
      tailwindcss(),
      nezhaRuntimeConfig(target),
      { name: 'zool:version', transformIndexHtml: (html) => html.replace('%ZOOL_VERSION%', pkg.version) },
    ],
    define: {
      __ZOOL_TARGET__: JSON.stringify(target),
      __ZOOL_VERSION__: JSON.stringify(pkg.version),
    },
    resolve: {
      alias: {
        '@adapter': src(`adapters/${target}/index.ts`),
        '@': src(''),
      },
    },
    server: {
      host: '127.0.0.1',
      proxy: upstream
        ? { ...proxied('/api'), ...(target === 'nezha' ? proxied('/dashboard') : {}) }
        : undefined,
    },
    build: {
      outDir: `dist/${outDir}`,
      emptyOutDir: true,
      sourcemap: false,
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 700,
    },
    test: {
      include: ['tests/**/*.test.ts'],
      environment: 'node',
    },
  }
})
