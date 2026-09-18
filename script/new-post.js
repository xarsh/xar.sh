import { readdirSync, writeFileSync } from 'node:fs'

const dir = 'content/post'
const existing = new Set(readdirSync(dir).map(f => f.replace(/^_/, '').replace('.mdoc', '')))

let id
do {
  id = String(Math.floor(Math.random() * 900_000_000) + 100_000_000)
} while (existing.has(id))

// `_` で始まるファイル名は下書き扱い（本番ビルド対象外、コミット不可）。
// date は実際の日付に書き換える。公開時にファイル名の `_` を外すこと。
const date = new Date().toISOString().slice(0, 10)
const path = `${dir}/_${id}.mdoc`

writeFileSync(path, `---\ntitle: \ndate: ${date}\nthumbnail: \n---\n`)
console.log(path)
