import * as tldraw from 'tldraw'
import { createShapeId, type Editor, type TLLineShape, type TLShapePartial } from 'tldraw'
import type { Fit, Point } from '../recognition/types'
import { annotate, cornersOf } from '../recognition/annotate'

export interface StrokeStyle {
  color: string
  size: string
  dash: string
}

// Toạ độ nhãn điểm của tldraw (a1..a9 là chỉ số phân số hợp lệ, đủ cho đa giác tối đa 8 đỉnh + điểm đóng)
const KEYS = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9']

function lineShape(points: Point[], style: StrokeStyle): TLShapePartial {
  const o = points[0]
  const rec: Record<string, { id: string; index: string; x: number; y: number }> = {}
  points.forEach((p, i) => { rec[KEYS[i]] = { id: KEYS[i], index: KEYS[i], x: p.x - o.x, y: p.y - o.y } })
  return {
    id: createShapeId(),
    type: 'line',
    x: o.x,
    y: o.y,
    props: { color: style.color, size: style.size, dash: style.dash, points: rec as unknown as TLLineShape['props']['points'] },
  } as TLShapePartial
}

/** Hình hộp (elip / chữ nhật) xoay quanh tâm: tldraw xoay quanh góc trên-trái nên phải bù vị trí. */
function boxShape(geo: 'ellipse' | 'rectangle', center: Point, w: number, h: number, rotation: number, style: StrokeStyle): TLShapePartial {
  const c = Math.cos(rotation), s = Math.sin(rotation)
  return {
    id: createShapeId(),
    type: 'geo',
    x: center.x - (c * (w / 2) - s * (h / 2)),
    y: center.y - (s * (w / 2) + c * (h / 2)),
    rotation,
    props: { geo, w, h, color: style.color, size: style.size, dash: style.dash, fill: 'none' },
  } as TLShapePartial
}

export interface Decor { labels: boolean; rightAngles: boolean }

/** Nhãn chữ. tldraw bản mới dùng richText, bản cũ dùng text: tự nhận biết để chạy được cả hai. */
function textShape(text: string, at: Point, small: boolean, color: string): TLShapePartial {
  const toRich = (tldraw as unknown as { toRichText?: (s: string) => unknown }).toRichText
  const content = toRich ? { richText: toRich(text) } : { text }
  const [dx, dy] = small ? [7, 12] : [9, 16] // dời để tâm nhãn trùng vị trí mong muốn
  return {
    id: createShapeId(),
    type: 'text',
    x: at.x - dx,
    y: at.y - dy,
    props: { ...content, color, size: small ? 's' : 'm', font: 'sans', autoSize: true, textAlign: 'middle' },
  } as TLShapePartial
}

/**
 * Tạo hình tldraw thật (chọn, kéo, đổi màu được) từ kết quả nhận diện, kèm nhãn đỉnh và ký hiệu góc vuông nếu bật.
 * Mọi hình phụ được gom nhóm với hình chính để kéo cùng nhau. Trả về id hình chính.
 */
export function createFromFit(editor: Editor, fit: Fit, style: StrokeStyle, decor: Decor) {
  let partial: TLShapePartial | null = null
  switch (fit.kind) {
    case 'line': partial = lineShape([fit.a, fit.b], style); break
    case 'ellipse': partial = boxShape('ellipse', fit.center, fit.w, fit.h, fit.rotation, style); break
    case 'rectangle': partial = boxShape('rectangle', fit.center, fit.w, fit.h, fit.rotation, style); break
    case 'polygon': partial = lineShape([...fit.vertices, fit.vertices[0]], style); break
    default: return null
  }
  editor.createShape(partial)

  const verts = cornersOf(fit)
  if (verts && (decor.labels || decor.rightAngles)) {
    const ann = annotate(verts, decor)
    const ids = [partial.id]
    const xs = verts.map((p) => p.x), ys = verts.map((p) => p.y)
    const small = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) < 120
    for (const ra of ann.rightAngles) {
      const sh = lineShape(ra, { ...style, size: 's', dash: 'solid' })
      editor.createShape(sh)
      ids.push(sh.id)
    }
    for (const l of ann.labels) {
      const sh = textShape(l.text, l.at, small, style.color)
      editor.createShape(sh)
      ids.push(sh.id)
    }
    if (ids.length > 1) {
      try { editor.groupShapes(ids) } catch { /* không gom được thì để rời, vẫn dùng bình thường */ }
    }
  }
  return partial.id
}
