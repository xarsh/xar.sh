import { getCollection } from 'astro:content'

// ファイル名が `_` で始まる投稿は下書き扱い。
// 本番ビルドでは除外し、dev では通常投稿と同様に扱う。
export const isDraft = (id: string) => id.startsWith('_')

const excludeDraftsInProd = (entry: { id: string }) => !import.meta.env.PROD || !isDraft(entry.id)

// 公開対象の投稿を新しい順で返す。
export async function getPosts() {
  const posts = await getCollection('post', excludeDraftsInProd)
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
}
