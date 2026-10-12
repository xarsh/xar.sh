import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import markdoc from '@astrojs/markdoc'
import sitemap from '@astrojs/sitemap'
import type { AstroIntegration } from 'astro'
import { defineConfig } from 'astro/config'

const MIME: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  mp4: 'video/mp4'
}

// dev 専用の配信。本番には出さない。
// - /.img-cache/: figure.astro がキャッシュした画像（オフライン執筆用）
// - /sw.js: img.xar.sh の画像をキャッシュする Service Worker（src/dev/sw.js）
const devAssets: AstroIntegration = {
  name: 'dev-assets',
  hooks: {
    'astro:server:setup': ({ server }) => {
      server.middlewares.use('/sw.js', async (_req, res) => {
        res.setHeader('Content-Type', 'text/javascript')
        res.setHeader('Cache-Control', 'no-cache')
        res.end(await readFile(new URL('./src/dev/sw.js', import.meta.url)))
      })
      server.middlewares.use('/.img-cache/', async (req, res, next) => {
        const name = basename(decodeURIComponent((req.url ?? '').split('?')[0]))
        try {
          const buf = await readFile(new URL(`./.img-cache/${name}`, import.meta.url))
          res.setHeader('Content-Type', MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream')
          res.setHeader('Cache-Control', 'no-cache')
          res.end(buf)
        } catch {
          next()
        }
      })
    }
  }
}

export default defineConfig({
  site: 'https://xar.sh',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  integrations: [markdoc({ allowHTML: true }), sitemap(), devAssets]
})
