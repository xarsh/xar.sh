import { Dropbox } from 'npm:dropbox'
import { S3Client, PutObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.241.0'
import pMap, { pMapSkip } from 'npm:p-map'
import sortBy from 'npm:just-sort-by'

const path = '/tmp' // Dropbox path to download
const Bucket = 'xarsh-img' // R2 bucket name
const MAX_WIDTH = 1280 // Max width of the image

const { ACCOUNT_ID, ACCESS_KEY_ID, SECRET_ACCESS_KEY, DROPBOX_ACCESS_TOKEN } = Deno.env.toObject()

const dbx = new Dropbox({ accessToken: DROPBOX_ACCESS_TOKEN })

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY }
})


const ffmpeg = str => {
  const args = ['-y', '-loglevel', 'error', ...str.split(' ')] // -y: overwrites output file if it exists
  const outputFile = args.at(-1)
  console.log('ffmpeg', args.join(' '))
  const { stdout, stderr } = new Deno.Command('ffmpeg', { args }).outputSync()
  if (stdout.length > 0) console.log(new TextDecoder().decode(stdout))
  if (stderr.length > 0) console.log(new TextDecoder().decode(stderr))
  return Deno.readFileSync(outputFile)
}

const files = await dbx.filesListFolder({ path }).then(res => res.result.entries.filter(ent => ent['.tag'] === 'file'))

const results = await pMap(files, async (file, idx) => {
  console.log(`Processing ${file.name}...`);
  const { result: image } = await dbx.filesDownload({ path: file.path_display })
  const imageId = image.content_hash
  const filePath = `/tmp/${imageId}`

  await Deno.writeFile(filePath, image.fileBinary)

  if (image.name.endsWith('.png')) { // PNG doesn't have EXIF
    const Body = ffmpeg(`-i ${filePath} ${filePath}.webp`)
    await s3.send(new PutObjectCommand({ Bucket, Key: `${imageId}.webp`, ContentType: 'image/webp', Body }))
    return { time: 0, line: `![](https://img.xar.sh/${imageId}.webp)` }
  }

  if (!image.media_info) {
    console.error(`No media info: ${image.name}`)
    return pMapSkip
  }
  const time = new Date(image.media_info.metadata.time_taken).getTime()
  const width = Math.min(image.media_info.metadata.dimensions.width, MAX_WIDTH)
  if (image.media_info.metadata['.tag'] === 'photo') {
    const Body = ffmpeg(`-i ${filePath} -vf scale=${width}:-1 ${filePath}.webp`)
    await s3.send(new PutObjectCommand({ Bucket, Key: `${imageId}.webp`, ContentType: 'image/webp', Body }))
    return { time, line: `![${idx}](https://img.xar.sh/${imageId}.webp)` }
  } else if (image.media_info.metadata['.tag'] === 'video') {
    const Body = ffmpeg(`-i ${filePath} -an -vf scale=${width}:-1 -vcodec libx264 -pix_fmt yuv420p ${filePath}.mp4`)
    await s3.send(new PutObjectCommand({ Bucket, Key: `${imageId}.mp4`, ContentType: 'video/mp4', Body }))
    return { time, line: `{{< video src="https://img.xar.sh/${imageId}.mp4" >}}` }
  }
  console.log(`Unknown media type: ${image.name}`)
  return pMapSkip
}, { concurrency: 1 })

sortBy(results, 'time').forEach(result => console.log(result.line))
