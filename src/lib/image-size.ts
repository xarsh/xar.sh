import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

type Size = { width?: number; height?: number }
type Media = Size & { src: string }

// dev 専用キャッシュ。リポジトリ直下 .img-cache/（gitignore 済み）。
// - index.json: URL -> { width, height }
// - <basename>: 画像の実体（オフライン執筆用）
// 一度取得した画像は寸法・実体ともローカルに残り、以降は再取得しない。
// このモジュールは dev でしか読み込まない（figure.astro / video.astro で動的 import）。
const CACHE_DIR = new URL('../../.img-cache/', import.meta.url)
const INDEX_PATH = new URL('index.json', CACHE_DIR)

mkdirSync(CACHE_DIR, { recursive: true })

let index: Record<string, Size> = {}
try {
  index = JSON.parse(readFileSync(INDEX_PATH, 'utf-8'))
} catch {
  index = {}
}

const inflight = new Map<string, Promise<Media>>()

const basename = (src: string) => src.split('/').pop()?.split('?')[0] ?? src

// +faststart で生成された MP4 の tkhd ボックスから寸法を読む。
// moov がファイル先頭にあることを前提とする。
function parseMp4Dimensions(buf: Buffer): Size | null {
  const findBox = (off: number, end: number, type: string) => {
    while (off < end - 8) {
      const size = buf.readUInt32BE(off)
      if (size < 8) break
      if (buf.toString('ascii', off + 4, off + 8) === type) return { s: off, e: off + size }
      off += size
    }
  }
  const moov = findBox(0, buf.length, 'moov')
  const trak = moov && findBox(moov.s + 8, moov.e, 'trak')
  const tkhd = trak && findBox(trak.s + 8, trak.e, 'tkhd')
  if (!tkhd) return null
  const version = buf.readUInt8(tkhd.s + 8)
  const off = tkhd.s + (version === 1 ? 96 : 84)
  return { width: buf.readUInt32BE(off) >> 16, height: buf.readUInt32BE(off + 4) >> 16 }
}

// dev で使うメディア情報 { src, width, height } を返す。
// src はローカルにキャッシュ済みなら /.img-cache/<name>、未取得（オフライン等）なら元 URL。
async function getDevMedia(src: string, measure: (buf: Buffer) => Promise<Size | null> | Size | null): Promise<Media> {
  const name = basename(src)
  const localSrc = `/.img-cache/${name}`
  const filePath = new URL(name, CACHE_DIR)

  // 寸法・実体ともキャッシュ済みならネットワーク不要
  if (index[src] && existsSync(filePath)) {
    return { src: localSrc, ...index[src] }
  }
  const pending = inflight.get(src)
  if (pending) return pending

  const promise = (async () => {
    const res = await fetch(src)
    if (!res.ok) throw new Error(`fetch failed: ${src} ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    writeFileSync(filePath, buffer)
    const dims = await measure(buffer)
    if (dims) {
      index[src] = dims
      writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2))
    }
    return { src: localSrc, ...dims }
  })()

  inflight.set(src, promise)
  try {
    return await promise
  } catch {
    // オフライン等で取得失敗。寸法だけでも分かれば返す（src は元 URL）。
    return { src, ...index[src] }
  } finally {
    inflight.delete(src)
  }
}

export const getDevImage = (src: string) =>
  getDevMedia(src, async (buf) => {
    const { width, height } = await sharp(buf).metadata()
    return { width, height }
  })

export const getDevVideo = (src: string) => getDevMedia(src, parseMp4Dimensions)
