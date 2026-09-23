import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

// dev 専用キャッシュ。リポジトリ直下 .img-cache/（gitignore 済み）。
// - index.json: URL -> { width, height }
// - <basename>: 画像の実体（オフライン執筆用）
// 一度取得した画像は寸法・実体ともローカルに残り、以降は再取得しない。
const CACHE_DIR = new URL('../../.img-cache/', import.meta.url)
const INDEX_PATH = new URL('index.json', CACHE_DIR)

mkdirSync(CACHE_DIR, { recursive: true })

let index = {}
try {
  index = JSON.parse(readFileSync(INDEX_PATH, 'utf-8'))
} catch {
  index = {}
}

const inflight = new Map()

const basename = (src) => src.split('/').pop().split('?')[0]

// +faststart で生成された MP4 の tkhd ボックスから寸法を読む。
// moov がファイル先頭にあることを前提とする。
function parseMp4Dimensions(buf) {
  const findBox = (buf, off, end, type) => {
    while (off < end - 8) {
      const size = buf.readUInt32BE(off)
      if (size < 8) break
      if (buf.toString('ascii', off + 4, off + 8) === type) return { s: off, e: off + size }
      off += size
    }
  }
  const moov = findBox(buf, 0, buf.length, 'moov')
  const trak = moov && findBox(buf, moov.s + 8, moov.e, 'trak')
  const tkhd = trak && findBox(buf, trak.s + 8, trak.e, 'tkhd')
  if (!tkhd) return null
  const version = buf.readUInt8(tkhd.s + 8)
  const off = tkhd.s + (version === 1 ? 96 : 84)
  return { width: buf.readUInt32BE(off) >> 16, height: buf.readUInt32BE(off + 4) >> 16 }
}

// getDevImage と同じキャッシュ構造で動画を扱う。寸法は parseMp4Dimensions で取得。
export async function getDevVideo(src) {
  const name = basename(src)
  const localSrc = `/.img-cache/${name}`
  const filePath = new URL(name, CACHE_DIR)

  if (index[src] && existsSync(filePath)) {
    return { src: localSrc, ...index[src] }
  }
  if (inflight.has(src)) return inflight.get(src)

  const promise = (async () => {
    const res = await fetch(src)
    if (!res.ok) throw new Error(`fetch failed: ${src} ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    writeFileSync(filePath, buffer)
    const dims = parseMp4Dimensions(buffer)
    if (dims) {
      index[src] = dims
      writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2))
    }
    return { src: localSrc, ...(dims ?? {}) }
  })()

  inflight.set(src, promise)
  try {
    return await promise
  } catch {
    return { src, ...(index[src] ?? {}) }
  } finally {
    inflight.delete(src)
  }
}

// dev で使う画像情報 { src, width, height } を返す。
// src はローカルにキャッシュ済みなら /.img-cache/<name>、未取得（オフライン等）なら元 URL。
export async function getDevImage(src) {
  const name = basename(src)
  const localSrc = `/.img-cache/${name}`
  const filePath = new URL(name, CACHE_DIR)

  // 寸法・実体ともキャッシュ済みならネットワーク不要
  if (index[src] && existsSync(filePath)) {
    return { src: localSrc, ...index[src] }
  }
  if (inflight.has(src)) return inflight.get(src)

  const promise = (async () => {
    const res = await fetch(src)
    if (!res.ok) throw new Error(`fetch failed: ${src} ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    writeFileSync(filePath, buffer)
    const { width, height } = await sharp(buffer).metadata()
    index[src] = { width, height }
    writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2))
    return { src: localSrc, width, height }
  })()

  inflight.set(src, promise)
  try {
    return await promise
  } catch {
    // オフライン等で取得失敗。寸法だけでも分かれば返す（src は元 URL）。
    return { src, ...(index[src] ?? {}) }
  } finally {
    inflight.delete(src)
  }
}
