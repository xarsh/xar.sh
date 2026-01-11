import { S3 } from 'npm:@aws-sdk/client-s3'

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = Deno.env.toObject()

const s3 = new S3({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }
})

const listObjects = async (Bucket, ContinuationToken) => {
  const { Contents = [], NextContinuationToken } = await s3.listObjectsV2({ Bucket, ContinuationToken })
  if (NextContinuationToken) {
    return [...Contents, ...(await listObjects(Bucket, NextContinuationToken))]
  }
  return Contents
}

const isUsed = filename => {
  const args = ['-r', '-l', '-F', filename, './content/post']
  const { code } = new Deno.Command('grep', { args }).outputSync()
  return code === 0
}

const backupObject = (Key) => {
  const url = `https://img.xar.sh/${Key}`
  const dest = `./r2-trash/${Key}`
  const dir = dest.substring(0, dest.lastIndexOf('/'))
  if (dir) Deno.mkdirSync(dir, { recursive: true })

  const args = ['-f', '-s', '-L', url, '-o', dest]
  const { code } = new Deno.Command('curl', { args }).outputSync()

  if (code !== 0) {
    throw new Error(`curl failed: ${Key}`)
  }
  return dest
}

for (const { Key } of await listObjects('xarsh-img')) {
  if (isUsed(Key)) {
    console.log(`USED: ${Key}`)
  } else {
    try {
      const saved = backupObject(Key)
      console.log(`UNUSED: ${Key}, BACKED UP -> ${saved}`)
    } catch (e) {
      console.error(`UNUSED: ${Key}, BACKUP FAILED (SKIP DELETE)`, e)
      continue
    }
    await s3.deleteObject({ Bucket: 'xarsh-img', Key })
    console.log(`UNUSED: ${Key}, DELETED`)
  }
}
