/** Địa chỉ back end lấy từ biến môi trường VITE_API_URL (file .env). Để trống thì giao diện tự dùng dữ liệu mẫu. */
/** VITE_DEMO=1: ép dùng dữ liệu mẫu dù đã đặt VITE_API_URL, để buổi trình bày không phụ thuộc mạng. */
export const DEMO: boolean = import.meta.env.VITE_DEMO === '1'
export const API_URL: string = DEMO ? '' : ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '')

async function request<T>(path: string, init: RequestInit, ms: number): Promise<T> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), ms)
  try {
    const res = await fetch(`${API_URL}${path}`, { ...init, signal: ctl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

export const postJson = <T>(path: string, body: unknown, ms = 30000) =>
  request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, ms)

export function postImage<T>(path: string, image: Blob, ms = 30000) {
  const form = new FormData()
  form.append('image', image, 'nets.png')
  return request<T>(path, { method: 'POST', body: form }, ms)
}
