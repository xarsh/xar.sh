import { Client } from 'npm:@microsoft/microsoft-graph-client@3.0.4'

const ACCESS_TOKEN = ''
const DRIVE_ID = ''
const ITEM_ID = '' // directory's id
const IMAGE_WIDTH = 1024
const client = Client.init({ authProvider: done => done(null, ACCESS_TOKEN) })

const imageIds = await client.api(`/drives/${DRIVE_ID}/items/${ITEM_ID}/children`).top(500).select('id').get()
const thumbnails = await Promise.all(imageIds.value.map(({ id }) => {
  return client.api(`/drives/${DRIVE_ID}/items/${id}/thumbnails?select=c999999x${IMAGE_WIDTH}`).get()
    .then(({ value }) => Object.values(value[0])[0].url)
}))
console.log(thumbnails.map((url, idx) => `![${idx}](${url})`).join('\n'))
