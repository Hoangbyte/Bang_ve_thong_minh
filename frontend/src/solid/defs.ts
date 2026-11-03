/** Định nghĩa các khối cơ bản: kích thước, các cạnh để vẽ nét liền/nét đứt, thể tích và diện tích. Không phụ thuộc three.js. */
export type SolidKind = 'box' | 'sphere' | 'cylinder' | 'cone' | 'pyramid'
export type Vec3 = [number, number, number]
export type Dims = Record<string, number>

export interface DimDef { key: string; min: number; max: number; step: number; def: number }

export const SOLID_KINDS: SolidKind[] = ['box', 'sphere', 'cylinder', 'cone', 'pyramid']

export const DIM_DEFS: Record<SolidKind, DimDef[]> = {
  box: [
    { key: 'a', min: 0.5, max: 5, step: 0.1, def: 3 },
    { key: 'b', min: 0.5, max: 5, step: 0.1, def: 2 },
    { key: 'c', min: 0.5, max: 5, step: 0.1, def: 2 },
  ],
  sphere: [{ key: 'r', min: 0.5, max: 3, step: 0.1, def: 1.5 }],
  cylinder: [
    { key: 'r', min: 0.5, max: 3, step: 0.1, def: 1.2 },
    { key: 'h', min: 0.5, max: 5, step: 0.1, def: 3 },
  ],
  cone: [
    { key: 'r', min: 0.5, max: 3, step: 0.1, def: 1.5 },
    { key: 'h', min: 0.5, max: 5, step: 0.1, def: 3 },
  ],
  pyramid: [
    { key: 'a', min: 0.5, max: 5, step: 0.1, def: 3 },
    { key: 'h', min: 0.5, max: 5, step: 0.1, def: 3 },
  ],
}

export const defaultDims = (kind: SolidKind): Dims => Object.fromEntries(DIM_DEFS[kind].map((d) => [d.key, d.def]))

const SEG = 72

/** Đường tròn bán kính r tại độ cao y (mặt phẳng xz). */
function ringXZ(r: number, y: number): Vec3[] {
  return Array.from({ length: SEG + 1 }, (_, i) => {
    const t = (i / SEG) * Math.PI * 2
    return [r * Math.cos(t), y, r * Math.sin(t)] as Vec3
  })
}
function ringXY(r: number): Vec3[] {
  return Array.from({ length: SEG + 1 }, (_, i) => { const t = (i / SEG) * Math.PI * 2; return [r * Math.cos(t), r * Math.sin(t), 0] as Vec3 })
}
function ringYZ(r: number): Vec3[] {
  return Array.from({ length: SEG + 1 }, (_, i) => { const t = (i / SEG) * Math.PI * 2; return [0, r * Math.cos(t), r * Math.sin(t)] as Vec3 })
}

/** Các đường cần vẽ của khối (mỗi đường là một dãy điểm). Khối đặt tâm ở gốc, trục y hướng lên. */
export function polylines(kind: SolidKind, d: Dims): Vec3[][] {
  switch (kind) {
    case 'box': {
      const x = d.a / 2, y = d.c / 2, z = d.b / 2
      const c = (sx: number, sy: number, sz: number): Vec3 => [sx * x, sy * y, sz * z]
      const edges: [Vec3, Vec3][] = []
      for (const sy of [-1, 1]) for (const [p, q] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) edges.push([c(p[0], sy, p[1]), c(q[0], sy, q[1])])
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) edges.push([c(sx, -1, sz), c(sx, 1, sz)])
      return edges
    }
    case 'sphere':
      return [ringXZ(d.r, 0), ringXY(d.r), ringYZ(d.r)]
    case 'cylinder': {
      const h = d.h / 2
      const gens = [0, 1, 2, 3].map((k): Vec3[] => { const t = (k * Math.PI) / 2; return [[d.r * Math.cos(t), -h, d.r * Math.sin(t)], [d.r * Math.cos(t), h, d.r * Math.sin(t)]] })
      return [ringXZ(d.r, -h), ringXZ(d.r, h), ...gens]
    }
    case 'cone': {
      const h = d.h / 2
      const gens = [0, 1, 2, 3].map((k): Vec3[] => { const t = (k * Math.PI) / 2; return [[0, h, 0], [d.r * Math.cos(t), -h, d.r * Math.sin(t)]] })
      return [ringXZ(d.r, -h), ...gens]
    }
    case 'pyramid': {
      const a = d.a / 2, h = d.h / 2
      const base: Vec3[] = [[-a, -h, -a], [a, -h, -a], [a, -h, a], [-a, -h, a]]
      const apex: Vec3 = [0, h, 0]
      return [[...base, base[0]], ...base.map((p): Vec3[] => [apex, p])]
    }
  }
}

export interface Metrics { volume: number; area: number }

export function metrics(kind: SolidKind, d: Dims): Metrics {
  const PI = Math.PI
  switch (kind) {
    case 'box': return { volume: d.a * d.b * d.c, area: 2 * (d.a * d.b + d.b * d.c + d.c * d.a) }
    case 'sphere': return { volume: (4 / 3) * PI * d.r ** 3, area: 4 * PI * d.r ** 2 }
    case 'cylinder': return { volume: PI * d.r ** 2 * d.h, area: 2 * PI * d.r * (d.r + d.h) }
    case 'cone': { const l = Math.hypot(d.r, d.h); return { volume: (PI * d.r ** 2 * d.h) / 3, area: PI * d.r * (d.r + l) } }
    case 'pyramid': { const l = Math.hypot(d.h, d.a / 2); return { volume: (d.a ** 2 * d.h) / 3, area: d.a ** 2 + 2 * d.a * l } }
  }
}
