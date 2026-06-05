import { component, defineMarkdocConfig } from '@astrojs/markdoc/config'

export default defineMarkdocConfig({
  nodes: {
    image: {
      render: component('./src/components/figure.astro'),
      attributes: {
        src: { type: String, required: true },
        alt: { type: String }
      }
    }
  },
  tags: {
    flex: {
      render: component('./src/components/flex.astro')
    },
    video: {
      render: component('./src/components/video.astro'),
      selfClosing: true,
      attributes: {
        src: { type: String, required: true },
        title: { type: String }
      }
    }
  }
})
