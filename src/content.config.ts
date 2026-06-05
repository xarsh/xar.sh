import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

const post = defineCollection({
  loader: glob({ pattern: '*.mdoc', base: 'content/post' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    thumbnail: z.url().optional()
  })
})

export const collections = { post }
