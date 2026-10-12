import Markdoc, { type Node } from '@markdoc/markdoc'

const MAX_LENGTH = 120

// 段落内のテキストだけを取り出す。画像や Markdoc タグは捨て、リンク・強調は中身を残す。
function plainText(node: Node): string {
  if (node.type === 'text') return node.attributes.content
  if (node.type === 'softbreak') return ' '
  if (node.type === 'image' || node.type === 'tag') return ''
  return node.children.map(plainText).join('')
}

// 本文冒頭の地の文から description 用の文字列を作る。
// 生 HTML（埋め込み等）だけの段落は text ノードとして現れるので、`<` 始まりは飛ばす。
export function extractDescription(body: string, maxLength = MAX_LENGTH): string {
  let text = ''
  for (const node of Markdoc.parse(body).children) {
    if (node.type !== 'paragraph') continue
    const paragraph = plainText(node).replace(/\s+/g, ' ').trim()
    if (!paragraph || paragraph.startsWith('<')) continue
    text += paragraph
    if (text.length >= maxLength) break
  }
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}
