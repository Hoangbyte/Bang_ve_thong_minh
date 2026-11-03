import type { TLGridProps } from 'tldraw'
import { useUiStore } from '../store/useUiStore'

/**
 * Lưới nền tuỳ biến cho tldraw (ô vuông / chấm / Oxy).
 * x, y = vị trí camera, z = mức zoom. Điểm gốc trang (0,0) nằm ở màn hình (x*z, y*z).
 * Khoảng cách lưới tự co giãn theo zoom nhưng luôn bám đúng gốc để trục Oxy khớp với hệ toạ độ.
 */
export function GridBackground({ x, y, z }: TLGridProps) {
  const kind = useUiStore((s) => s.grid)

  let base = 40 // đơn vị trang
  while (base * z < 18) base *= 2
  while (base * z > 90 && base > 2.5) base /= 2
  const step = base * z
  const sx = x * z // vị trí gốc O trên màn hình
  const sy = y * z
  const ox = ((sx % step) + step) % step
  const oy = ((sy % step) + step) % step
  const id = `btm-grid-${kind}`

  return (
    <svg
      className="tl-grid"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <defs>
        <pattern id={id} x={ox} y={oy} width={step} height={step} patternUnits="userSpaceOnUse">
          {kind === 'dots' ? (
            <circle cx={0} cy={0} r={1.5} fill="var(--grid)" />
          ) : (
            <path d={`M0 0H${step}M0 0V${step}`} stroke="var(--grid)" strokeWidth={2} fill="none" />
          )}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
      {kind === 'oxy' && (
        <g stroke="var(--axis)" strokeWidth={1.75}>
          <line x1={0} x2="100%" y1={sy} y2={sy} />
          <line y1={0} y2="100%" x1={sx} x2={sx} />
          <text x={sx - 14} y={sy + 16} fontSize={13} fill="var(--axis)" stroke="none">O</text>
        </g>
      )}
    </svg>
  )
}
