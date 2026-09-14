import { Dropbox } from 'dropbox'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import pLimit from 'p-limit'
import { spawnSync } from 'node:child_process'
import { writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dropboxPath = process.argv[2] ?? '/tmp'
const Bucket = 'xarsh-img' // R2 bucket name
const MAX_WIDTH = 1920 // Max width of the image

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env
const { DBX_CLIENT_ID, DBX_CLIENT_SECRET, DBX_REFRESH_TOKEN } = process.env

const dbx = new Dropbox({ clientId: DBX_CLIENT_ID, clientSecret: DBX_CLIENT_SECRET, refreshToken: DBX_REFRESH_TOKEN })

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }
})

const toWebp = (buf, width) => sharp(buf).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 90, effort: 6, smartSubsample: true }).toBuffer()
const toPng = buf => sharp(buf).png().toBuffer()
const toMp4 = (buf, width) => {
  const dir = tmpdir()
  const tmpIn = join(dir, `ffmpeg-in-${Date.now()}`)
  const tmpOut = tmpIn + '.mp4'
  writeFileSync(tmpIn, buf)
  const { status } = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmpIn, '-an', '-vf', `scale=${width}:-2`, '-vcodec', 'libx264', '-crf', '20', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', tmpOut], { stdio: 'inherit' })
  if (status !== 0) throw new Error('ffmpeg failed')
  const result = readFileSync(tmpOut)
  rmSync(tmpIn)
  rmSync(tmpOut)
  return result
}

const formatDateTaken = time => {
  if (!time) return ''
  const d = new Date(time)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const retry = async (fn, attempts = 5, delay = 3000) => {
  for (let i = 0; i < attempts; i++) {
    try { return await fn() } catch (err) {
      if (i === attempts - 1) throw err
      console.error(`  retry ${i + 1}/${attempts - 1} after error: ${err.message}`)
      await new Promise(r => setTimeout(r, delay * (i + 1)))
    }
  }
}

// Use built-in fetch (Node 18+) to avoid node-fetch PassThrough stream crash bugs
const downloadFromDropbox = async (filePath) => {
  await dbx.auth.checkAndRefreshAccessToken()
  const token = dbx.auth.getAccessToken()
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), 180_000) // 3 min timeout
  try {
    const res = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path: filePath }),
      },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Dropbox HTTP ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  } finally {
    clearTimeout(tid)
  }
}

const files = await dbx.filesListFolder({ path: dropboxPath, include_media_info: true })
  .then(res => res.result.entries.filter(ent => ent['.tag'] === 'file'))

const limit = pLimit(3)
const results = await Promise.all(files.map(file => limit(async () => {
  const imageId = file.content_hash.slice(0, 16)
  const listMeta = file.media_info?.['.tag'] === 'metadata' ? file.media_info.metadata : null
  const tag = listMeta?.['.tag']
  const time = listMeta?.time_taken ? new Date(listMeta.time_taken).getTime() : 0
  const origW = listMeta?.dimensions?.width
  const origH = listMeta?.dimensions?.height
  const outW = origW ? Math.min(origW, MAX_WIDTH) : MAX_WIDTH
  const outH = origW && origH ? Math.round(origH * outW / origW) : undefined
  const dims = outH ? ` {% width=${outW} height=${outH} %}` : ''
  const dateTaken = formatDateTaken(time)
  const isVideo = tag === 'video' || /\.(mp4|mov|avi|mkv|m4v|mts|m2ts)$/i.test(file.name)
  const ext = isVideo ? 'mp4' : file.name.endsWith('.png') ? 'png' : 'webp'
  const Key = `${imageId}.${ext}`

  console.log(`Processing ${file.name}...`)
  const buf = await retry(() => downloadFromDropbox(file.path_display))

  if (isVideo) {
    const Body = toMp4(buf, outW)
    await s3.send(new PutObjectCommand({ Bucket, Key, ContentType: 'video/mp4', Body }))
    const sizeAttrs = outH ? ` width=${outW} height=${outH}` : ''
    return { time, line: `{% video title="${dateTaken}" src="https://img.xar.sh/${Key}"${sizeAttrs} /%}` }
  } else if (file.name.endsWith('.png')) {
    const Body = await toPng(buf)
    await s3.send(new PutObjectCommand({ Bucket, Key, ContentType: 'image/png', Body }))
    return { time, line: `![${dateTaken}](https://img.xar.sh/${Key})${dims}` }
  } else {
    const Body = await toWebp(buf, outW)
    await s3.send(new PutObjectCommand({ Bucket, Key, ContentType: 'image/webp', Body }))
    return { time, line: `![${dateTaken}](https://img.xar.sh/${Key})${dims}` }
  }
})))

const lines = results.toSorted((a, b) => a.time - b.time).map(r => r.line)
console.log(lines.join('\n\n'))
