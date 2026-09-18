// ファイル名が `_` で始まる投稿は下書き扱い。
// 本番ビルドでは除外し、dev では通常投稿と同様に扱う。
export const isDraft = (id) => id.startsWith('_')

export const excludeDraftsInProd = (entry) => !import.meta.env.PROD || !isDraft(entry.id)
