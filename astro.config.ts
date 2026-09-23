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

// dev 専用: figure.astro がキャッシュした画像を .img-cache/ から配信する（オフライン執筆用）。
const devImageCache: AstroIntegration = {
  name: 'dev-image-cache',
  hooks: {
    'astro:server:setup': ({ server }) => {
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
  integrations: [markdoc({ allowHTML: true }), sitemap(), devImageCache]
})
