import { getCollection } from 'astro:content'
import rss from '@astrojs/rss'
import type { APIContext } from 'astro'

export async function GET(context: APIContext) {
  const posts = (await getCollection('post')).sort((a, b) => b.data.date.getTime() - a.data.date.getTime()).slice(0, 20)

  return rss({
    title: 'xar.sh',
    description: 'Recent content on xar.sh',
    site: context.site ?? new URL('https://xar.sh'),
    xmlns: {
      media: 'http://search.yahoo.com/mrss/'
    },
    items: posts.map((post) => ({
      title: post.data.title,
      link: `/post/${post.id}/`,
      pubDate: post.data.date,
      customData: post.data.thumbnail ? `<media:content url="${post.data.thumbnail}" medium="image" />` : undefined
    }))
  })
}
