import { Dropbox } from 'dropbox'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const path = '/tmp' // Dropbox path to download
const Bucket = 'xarsh-img' // R2 bucket name
const MAX_WIDTH = 1280 // Max width of the image

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env
const { DBX_CLIENT_ID, DBX_CLIENT_SECRET, DBX_REFRESH_TOKEN } = process.env

const dbx = new Dropbox({ fetch, clientId: DBX_CLIENT_ID, clientSecret: DBX_CLIENT_SECRET, refreshToken: DBX_REFRESH_TOKEN })

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }
})

const ffmpeg = str => {
  const args = ['-y', '-loglevel', 'error', ...str.split(' ')] // -y: overwrites output file if it exists
  const outputFile = args.at(-1)
  console.log('ffmpeg', args.join(' '))
  execFileSync('ffmpeg', args, { stdio: ['ignore', 'inherit', 'inherit'] })
  return readFileSync(outputFile)
}

const files = await dbx.filesListFolder({ path }).then(res => res.result.entries.filter(ent => ent['.tag'] === 'file'))

const results = []
for (const [idx, file] of files.entries()) {
  console.log(`Processing ${file.name}...`);
  const { result: image } = await dbx.filesDownload({ path: file.path_display })
  const imageId = image.content_hash.slice(0, 16) // Use first 16 chars of the hash as the image ID
  const filePath = `/tmp/${imageId}`

  const buf = await image.fileBlob.arrayBuffer()
  writeFileSync(filePath, new Uint8Array(buf))

  if (image.name.endsWith('.png')) { // PNG doesn't have EXIF
    const Body = ffmpeg(`-i ${filePath} -y -update true ${filePath}.png`)
    await s3.send(new PutObjectCommand({ Bucket, Key: `${imageId}.png`, ContentType: 'image/png', Body }))
    results.push({ time: 0, line: `![](https://img.xar.sh/${imageId}.png)` })
    continue
  }

  if (!image.media_info) {
    console.error(`No media info: ${image.name}`)
    continue
  }
  const time = new Date(image.media_info.metadata.time_taken).getTime()
  const width = Math.min(image.media_info.metadata.dimensions.width, MAX_WIDTH)
  if (image.media_info.metadata['.tag'] === 'photo') {
    const Body = ffmpeg(`-i ${filePath} -vf scale=${width}:-1 -y -q:v 80 -update true ${filePath}.webp`)
    await s3.send(new PutObjectCommand({ Bucket, Key: `${imageId}.webp`, ContentType: 'image/webp', Body }))
    results.push({ time, line: `![${idx}](https://img.xar.sh/${imageId}.webp)` })
    continue
  }
  if (image.media_info.metadata['.tag'] === 'video') {
    const Body = ffmpeg(`-i ${filePath} -an -vf scale=${width}:-1 -vcodec libx264 -pix_fmt yuv420p -y -update true ${filePath}.mp4`)
    await s3.send(new PutObjectCommand({ Bucket, Key: `${imageId}.mp4`, ContentType: 'video/mp4', Body }))
    results.push({ time, line: `{% video title="${idx}" src="https://img.xar.sh/${imageId}.mp4" /%}` })
    continue
  }
  console.log(`Unknown media type: ${image.name}`)
}

for (const result of results.toSorted((a, b) => a.time - b.time)) {
  console.log(result.line)
}
