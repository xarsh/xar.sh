import { S3 } from 'npm:@aws-sdk/client-s3'

const { ACCOUNT_ID, ACCESS_KEY_ID, SECRET_ACCESS_KEY } = Deno.env.toObject()

const s3 = new S3({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY }
})

const listObjects = async (Bucket, ContinuationToken) => {
  const { Contents, NextContinuationToken } = await s3.listObjectsV2({ Bucket, ContinuationToken })
  if (NextContinuationToken) {
    return [...Contents, ...(await listObjects(Bucket, NextContinuationToken))]
  }
  return Contents
}

const isUsed = filename => {
  const args = ['-r', '-l', filename, './content/post']
  const { code } = new Deno.Command('grep', { args }).outputSync()
  return code === 0
}

for (const { Key } of await listObjects('xarsh-img')) {
  if (isUsed(Key)) {
    console.log(`USED: ${Key}`)
  } else {
    await s3.deleteObject({ Bucket: 'xarsh-img', Key })
    console.log(`UNUSED: ${Key}, DELETED`)
  }
}
