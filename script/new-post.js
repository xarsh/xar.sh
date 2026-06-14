import { readdirSync, writeFileSync } from 'node:fs'

const dir = 'content/post'
const existing = new Set(readdirSync(dir).map(f => f.replace('.mdoc', '')))

let id
do {
  id = String(Math.floor(Math.random() * 900_000_000) + 100_000_000)
} while (existing.has(id))

const date = '9999-12-31'
const path = `${dir}/${id}.mdoc`

writeFileSync(path, `---\ntitle: \ndate: ${date}\nthumbnail: \n---\n`)
console.log(path)
