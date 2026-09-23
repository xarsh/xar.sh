// .dev/ はローカル専用ツール置き場（gitignore 済み、コミットしない）。
// 存在すれば動的に読み込み、無ければ何もしない。呼び出し側は .dev/ の有無を意識しなくていい。
export async function loadDevTool(path) {
  if (!import.meta.env.DEV) return undefined
  try {
    const mod = await import(/* @vite-ignore */ `../../.dev/${path}`)
    return mod.default
  } catch {
    return undefined
  }
}
