export interface Point { x: number; y: number }

export type ShapeKind = 'line' | 'circle' | 'ellipse' | 'triangle' | 'rectangle' | 'polygon' | 'unknown'

/** Hình học đã được "làm đẹp", đủ để dựng lại hình ở bất kỳ canvas nào (không phụ thuộc tldraw). */
export type Fit =
  | { kind: 'line'; a: Point; b: Point }
  | { kind: 'ellipse'; center: Point; w: number; h: number; rotation: number; circle: boolean }
  | { kind: 'rectangle'; center: Point; w: number; h: number; rotation: number; square: boolean }
  | { kind: 'polygon'; vertices: Point[] }
  | { kind: 'none' }

export interface Recognition {
  kind: ShapeKind
  /** 0..1. Dưới MIN_CONFIDENCE thì giao diện giữ nguyên nét vẽ. */
  confidence: number
  fit: Fit
}
