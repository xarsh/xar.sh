import { Dropbox } from 'dropbox'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import sharp from 'sharp'

const path = '/tmp' // Dropbox path to download
const Bucket = 'xarsh-img' // R2 bucket name
const MAX_WIDTH = 1280 // Max width of the image

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env
const { DBX_CLIENT_ID, DBX_CLIENT_SECRET, DBX_REFRESH_TOKEN } = process.env

const dbx = new Dropbox({ clientId: DBX_CLIENT_ID, clientSecret: DBX_CLIENT_SECRET, refreshToken: DBX_REFRESH_TOKEN })

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }
})

const ffmpeg = new FFmpeg()
await ffmpeg.load()

const toWebp = (buf, width) => sharp(buf).resize({ width, withoutEnlargement: true }).webp({ quality: 90, effort: 6, smartSubsample: false }).toBuffer()
const toPng = buf => sharp(buf).png().toBuffer()
const toMp4 = async (buf, width) => {
  await ffmpeg.writeFile('input', await fetchFile(buf))
  await ffmpeg.exec(['-i', 'input', '-an', '-vf', `scale=${width}:-2`, '-vcodec', 'libx264', '-crf', '18', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'output.mp4'])
  return ffmpeg.readFile('output.mp4')
}

const files = await dbx.filesListFolder({ path }).then(res => res.result.entries.filter(ent => ent['.tag'] === 'file'))

const results = []
for (const [idx, file] of files.entries()) {
  console.log(`Processing ${file.name}...`)
  const { result: image } = await dbx.filesDownload({ path: file.path_display })
  const imageId = image.content_hash.slice(0, 16)
  const meta = image.media_info?.metadata
  const tag = meta?.['.tag']
  const time = meta?.time_taken ? new Date(meta.time_taken).getTime() : 0
  const width = meta?.dimensions?.width ? Math.min(meta.dimensions.width, MAX_WIDTH) : MAX_WIDTH

  if (tag === 'video') {
    const Body = await toMp4(image.fileBinary, width)
    await s3.send(new PutObjectCommand({ Bucket, Key: `${imageId}.mp4`, ContentType: 'video/mp4', Body }))
    results.push({ time, line: `{% video title="${idx}" src="https://img.xar.sh/${imageId}.mp4" /%}` })
  } else if (image.name.endsWith('.png')) {
    const Body = await toPng(image.fileBinary)
    await s3.send(new PutObjectCommand({ Bucket, Key: `${imageId}.png`, ContentType: 'image/png', Body }))
    results.push({ time, line: `![](https://img.xar.sh/${imageId}.png)` })
  } else {
    const Body = await toWebp(image.fileBinary, width)
    await s3.send(new PutObjectCommand({ Bucket, Key: `${imageId}.webp`, ContentType: 'image/webp', Body }))
    results.push({ time, line: `![${idx}](https://img.xar.sh/${imageId}.webp)` })
  }
}

for (const result of results.toSorted((a, b) => a.time - b.time)) {
  console.log(result.line)
}
