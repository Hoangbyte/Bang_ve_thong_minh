import { useEffect } from 'react'
import type { Editor, TLShapeId } from 'tldraw'
import { useEditorStore } from '../store/useEditorStore'
import { useUiStore } from '../store/useUiStore'
import { useSnapStore } from '../store/useSnapStore'
import { recognizeShape } from '../api/contract'
import { MIN_SNAP_CONFIDENCE } from '../recognition/recognizer'
import type { Point, Recognition } from '../recognition/types'
import { createFromFit } from './shapeBuilder'

/** Giữ bút yên tối thiểu bao lâu trước khi nhấc thì mới làm đẹp. */
const HOLD_MS = 500
/** Di chuyển dưới mức này (pixel màn hình) vẫn coi là giữ yên (tay run, bút rung). */
const MOVE_TOL = 4
/** Dưới mức tin cậy này thì giữ nguyên nét vẽ. */
const MIN_CONFIDENCE = MIN_SNAP_CONFIDENCE

/** Đánh dấu điểm dừng lịch sử để Ctrl+Z chỉ hoàn tác phần AI sửa, nét gốc vẫn còn. */
function markUndoPoint(editor: Editor) {
  const e = editor as unknown as { markHistoryStoppingPoint?: (n: string) => void; mark?: (n: string) => void }
  if (e.markHistoryStoppingPoint) e.markHistoryStoppingPoint('ai-snap')
  else e.mark?.('ai-snap')
}

function shapeKeyOf(r: Recognition): string {
  if (r.fit.kind === 'rectangle' && r.fit.square) return 'square'
  return r.kind
}

/**
 * Làm đẹp nét vẽ: khi người dùng vẽ xong bằng công cụ bút và giữ yên HOLD_MS trước khi nhấc,
 * nhận diện nét rồi thay bằng hình chuẩn. Chỉ chạy khi công tắc "AI làm đẹp" đang bật.
 */
export function useAutoBeautify() {
  const editor = useEditorStore((s) => s.editor)

  useEffect(() => {
    if (!editor) return

    // --- Theo dõi con trỏ để biết lúc nhấc bút đã giữ yên bao lâu ---
    let anchor = { x: 0, y: 0 }
    let lastMoveAt = 0
    let lastUpAt = 0
    let downAt = 0
    const onDown = (ev: PointerEvent) => {
      anchor = { x: ev.clientX, y: ev.clientY }
      lastMoveAt = downAt = performance.now()
      // Chạm vào canvas thì ẩn thông báo cũ
      if ((ev.target as HTMLElement | null)?.closest?.('.tl-container')) useSnapStore.getState().setEvent(null)
    }
    const onMove = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - anchor.x, ev.clientY - anchor.y) > MOVE_TOL) {
        anchor = { x: ev.clientX, y: ev.clientY }
        lastMoveAt = performance.now()
      }
    }
    const onUp = () => { lastUpAt = performance.now() }
    // capture: chạy trước bộ xử lý của tldraw nên thời điểm nhấc bút đã được ghi nhận khi nét hoàn tất
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)

    const pageToScreen = (p: Point) => {
      const v = editor.pageToViewport(p)
      return { x: v.x, y: v.y }
    }

    const beautify = async (id: TLShapeId) => {
      const shape = editor.getShape(id)
      if (!shape || shape.type !== 'draw') return
      const draw = shape as typeof shape & { props: { segments: { points: Point[] }[]; color: string; size: string; dash: string } }

      // Điểm của nét, đổi sang toạ độ trang
      const tf = editor.getShapePageTransform(id)
      const pts: Point[] = []
      for (const seg of draw.props.segments) for (const p of seg.points) {
        const q = tf.applyToPoint(p)
        pts.push({ x: q.x, y: q.y })
      }

      const result = await recognizeShape(pts) // GẮN API THẬT TẠI ĐÂY nếu muốn nhận diện ở server
      if (!editor.getShape(id)) return // nét đã bị xoá trong lúc chờ

      const key = Date.now()
      const set = useSnapStore.getState().setEvent
      if (result.kind === 'unknown' || result.confidence < MIN_CONFIDENCE) {
        set({ key, status: 'kept', confidence: result.confidence })
        return
      }

      const step = Math.max(1, Math.floor(pts.length / 80))
      const ghost = pts.filter((_, i) => i % step === 0).map((p, i) => {
        const s = pageToScreen(p)
        return `${i === 0 ? 'M' : 'L'}${s.x.toFixed(1)} ${s.y.toFixed(1)}`
      }).join(' ')

      const created: { id: TLShapeId | null } = { id: null }
      markUndoPoint(editor)
      editor.run(() => {
        const dash = draw.props.dash === 'draw' ? 'solid' : draw.props.dash
        const ui = useUiStore.getState()
        created.id = createFromFit(
          editor,
          result.fit,
          { color: draw.props.color, size: draw.props.size, dash },
          { labels: ui.labelVertices, rightAngles: ui.rightAngles }
        ) as TLShapeId | null
        if (created.id) editor.deleteShape(id)
      })
      const newId = created.id
      if (!newId) return

      const b = editor.getShapePageBounds(newId)
      const z = editor.getZoomLevel()
      const origin = b ? pageToScreen({ x: b.x, y: b.y }) : null
      set({
        key,
        status: 'snapped',
        shapeKey: shapeKeyOf(result),
        confidence: result.confidence,
        ghost,
        box: b && origin ? { x: origin.x, y: origin.y, w: b.w * z, h: b.h * z } : undefined,
      })
    }

    // --- Bắt thời điểm nét vẽ hoàn tất (isComplete: false -> true) ---
    const stop = editor.sideEffects.registerAfterChangeHandler('shape', (prev, next, source) => {
      if (source !== 'user' || next.type !== 'draw' || prev.type !== 'draw') return
      const p = prev as typeof prev & { props: { isComplete: boolean } }
      const n = next as typeof next & { props: { isComplete: boolean } }
      if (p.props.isComplete || !n.props.isComplete) return
      if (!useUiStore.getState().aiBeautify) return

      const now = performance.now()
      if (now - lastUpAt > 200 || lastUpAt < downAt) return // không phải do vừa nhấc bút (vd: hoàn tác/làm lại)
      if (lastUpAt - lastMoveAt < HOLD_MS) return // chưa giữ yên đủ lâu
      const id = next.id
      setTimeout(() => { void beautify(id) }, 0) // để tldraw ghi xong nét gốc rồi mới thay
    })

    return () => {
      stop()
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
    }
  }, [editor])
}
