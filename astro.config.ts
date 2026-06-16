import markdoc from '@astrojs/markdoc'
import sitemap from '@astrojs/sitemap'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://xar.sh',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  integrations: [markdoc({ allowHTML: true }), sitemap()]
})
