import { readdirSync, writeFileSync } from 'node:fs'

const dir = 'content/post'
const existing = new Set(readdirSync(dir).map(f => f.replace('.mdoc', '')))

let id
do {
  id = String(Math.floor(Math.random() * 900_000_000) + 100_000_000)
} while (existing.has(id))

const date = new Date().toISOString().slice(0, 10)
const path = `${dir}/${id}.mdoc`

writeFileSync(path, `---\ntitle: \ndate: ${date}\n---\n`)
console.log(path)
