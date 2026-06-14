import { Dropbox } from 'dropbox'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

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

  writeFileSync(filePath, image.fileBinary)

  if (image.name.endsWith('.png')) { // PNG doesn't have EXIF
    const Body = ffmpeg(`-i ${filePath} -y -update true ${filePath}.png`)
    await s3.send(new PutObjectCommand({ Bucket, Key: `${imageId}.png`, ContentType: 'image/png', Body }))
    results.push({ time: 0, line: `![](https://img.xar.sh/${imageId}.png)` })
    continue
  }

  if (image.name.endsWith('.heic')) {
    const width = image.media_info?.metadata?.dimensions?.width
      ? Math.min(image.media_info.metadata.dimensions.width, MAX_WIDTH)
      : MAX_WIDTH
    // ffmpeg for heic→png conversion, then cwebp for webp encoding (matching photo branch)
    ffmpeg(`-i ${filePath} -y -update true ${filePath}.png`)
    const outPath = `${filePath}.webp`
    execFileSync('cwebp', ['-quiet', '-resize', String(width), '0', '-q', '80', `${filePath}.png`, '-o', outPath], { stdio: 'ignore' })
    const Body = readFileSync(outPath)
    await s3.send(new PutObjectCommand({ Bucket, Key: `${imageId}.webp`, ContentType: 'image/webp', Body }))
    const time = image.media_info?.metadata?.time_taken ? new Date(image.media_info.metadata.time_taken).getTime() : 0
    results.push({ time, line: `![${idx}](https://img.xar.sh/${imageId}.webp)` })
    continue
  }

  if (!image.media_info) {
    console.error(`No media info: ${image.name}`)
    continue
  }
  const time = new Date(image.media_info.metadata.time_taken).getTime()
  const width = Math.min(image.media_info.metadata.dimensions.width, MAX_WIDTH)
  if (image.media_info.metadata['.tag'] === 'photo') {
    const outPath = `${filePath}.webp`
    execFileSync('cwebp', ['-quiet', '-resize', String(width), '0', '-q', '80', filePath, '-o', outPath], { stdio: 'ignore' })
    const Body = readFileSync(outPath)
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
