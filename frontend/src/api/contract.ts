/**
 * HỢP ĐỒNG 5 HÀM AI/BACKEND (đang trả dữ liệu MOCK).
 * LƯU Ý: đồ thị đã chạy hoàn toàn ở trình duyệt (src/graph), nên backend KHÔNG cần vẽ đồ thị.
 * Backend cần làm: recognizeMath (trả LaTeX, GraphPanel nhận qua analyse), giải từng bước bằng SymPy, askAssistant.
 * generateGraph chỉ còn là chỗ chờ cho phần giải từng bước.
 * Khi ghép backend thật, chỉ thay phần thân hàm bằng fetch(`${API_URL}/...`), giữ nguyên kiểu dữ liệu.
 */
import { API_URL, postImage, postJson } from './http'
import { recognizeStroke } from '../recognition/recognizer'
import type { Point, Recognition } from '../recognition/types'

export type { Point }
export type ShapeResult = Recognition
export interface MathResult { latex: string; confidence: number }
export interface GraphSpec { expression: string; special: { label: string; x: number; y: number }[] }
export interface Solid { kind: 'box' | 'sphere' | 'cylinder' | 'cone' | 'pyramid'; confidence: number }

/** Giai đoạn 2: chạy thật trên trình duyệt (src/recognition), không cần backend. */
export async function recognizeShape(points: Point[]): Promise<ShapeResult> {
  return recognizeStroke(points)
}
/** image: ảnh PNG các nét viết đang chọn. Có VITE_API_URL thì gọi POST /api/recognize-math (multipart, trường `image`), trả {latex, confidence}. */
export async function recognizeMath(image: Blob | null): Promise<MathResult> {
  if (API_URL && image) {
    const r = (await postImage<unknown>('/api/recognize-math', image)) as Partial<MathResult> | null
    // Kiểm tra dạng dữ liệu để back end trả sai không làm hỏng giao diện
    if (!r || typeof r.latex !== 'string' || !r.latex.trim() || typeof r.confidence !== 'number' || !(r.confidence >= 0 && r.confidence <= 1)) throw new Error('Phản hồi đọc chữ không hợp lệ')
    return { latex: r.latex, confidence: r.confidence }
  }
  return { latex: 'y = x^2 - 4x + 3', confidence: 0.9 } // GẮN API ĐỌC CHỮ VIẾT TAY TẠI ĐÂY
}
/** HÀM CHỜ, chưa được gọi: đồ thị đã chạy ở trình duyệt. Dành cho back end (SymPy) trả nghiệm ký hiệu và lời giải từng bước. */
export async function generateGraph(_latex: string): Promise<GraphSpec> {
  return { expression: 'x^2 - 4*x + 3', special: [{ label: 'Đỉnh', x: 2, y: -1 }] } // GẮN SYMPY/BACKEND TẠI ĐÂY
}
/** HÀM CHỜ, chưa được gọi: nhận dạng khối 3D từ nét phác do back end phát triển; hiện chọn khối từ menu. */
export async function build3DFromSketch(_points: Point[]): Promise<Solid> {
  return { kind: 'box', confidence: 0.5 } // GẮN API THẬT TẠI ĐÂY
}
export interface AssistantContext {
  /** Các phương trình đang vẽ ở tab Đồ thị. */
  graph?: string[]
  /** Loại khối đang xem ở tab Hình 3D. */
  solid?: string
  /** Vài lượt hội thoại gần nhất (không gồm câu hỏi hiện tại), để câu hỏi nối tiếp hoạt động. */
  history?: { role: 'user' | 'assistant'; text: string }[]
}
/** MOCK: giả lập độ trễ và trả lời mẫu. Gõ "/loi" để thử trạng thái lỗi của khung chat. */
/** Có VITE_API_URL thì gọi POST /api/assistant, body {message, context}, trả {reply} (văn bản thuần, công thức trong $...$). */
export async function askAssistant(message: string, context?: AssistantContext): Promise<string> {
  if (API_URL) {
    const r = (await postJson<unknown>('/api/assistant', { message, context }, 60000)) as { reply?: unknown } | null
    if (!r || typeof r.reply !== 'string') throw new Error('Phản hồi trợ lý không hợp lệ')
    return r.reply
  }
  await new Promise((r) => setTimeout(r, 800))
  if (message.trim() === '/loi') throw new Error('mock error')
  const graph = context?.graph?.length ? `

Đồ thị đang vẽ: ${context.graph.join(';  ')}` : ''
  return `Đây là câu trả lời mẫu, trợ lý thật chưa được kết nối. Bạn hỏi: "${message}". Công thức ví dụ: $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$${graph}` // GẮN API CHAT THẬT TẠI ĐÂY
}
