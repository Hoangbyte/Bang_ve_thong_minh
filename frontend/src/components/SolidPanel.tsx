import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImagePlus } from 'lucide-react'
import { useSolidStore } from '../store/useSolidStore'
import { useEditorStore } from '../store/useEditorStore'
import { DIM_DEFS, SOLID_KINDS, metrics } from '../solid/defs'
import { dropImageToBoard } from '../graph/dropToBoard'
import { fmt } from '../graph/format'
import type { CaptureResult } from './Solid3D'

// Tải three.js khi cần để lần mở trang đầu nhẹ hơn
const Solid3D = lazy(() => import('./Solid3D'))

/** Tab "Hình 3D": chọn khối, chỉnh kích thước, xoay/zoom, bật tắt nét khuất, xem thể tích và diện tích, thả lên bảng. */
export function SolidPanel() {
  const { t } = useTranslation()
  const { kind, dims, showHidden, setKind, setDim, setShowHidden } = useSolidStore()
  const editor = useEditorStore((s) => s.editor)
  const capture = useRef<(() => CaptureResult) | null>(null)
  const [dropped, setDropped] = useState(false)
  const onReady = useCallback((fn: () => CaptureResult) => { capture.current = fn }, [])

  const d = dims[kind]
  const m = metrics(kind, d)

  useEffect(() => {
    if (!dropped) return
    const timer = setTimeout(() => setDropped(false), 3000)
    return () => clearTimeout(timer)
  }, [dropped])

  const drop = () => {
    const shot = capture.current?.()
    if (!editor || !shot) return
    dropImageToBoard(editor, shot.url, 'image/png', shot.w, shot.h, 'hinh-3d.png')
    setDropped(true)
  }

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label={t('solid.label')} className="flex flex-wrap gap-1.5">
        {SOLID_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`h-10 rounded-full px-3 text-sm font-medium transition-colors motion-reduce:transition-none ${
              kind === k ? 'bg-accent text-on-accent' : 'border border-line text-ink hover:bg-hover'
            }`}
          >
            {t(`solid.kinds.${k}`)}
          </button>
        ))}
      </div>

      <section>
        <div className="overflow-hidden rounded-xl border border-line" style={{ background: '#ffffff' }}>
          <Suspense fallback={<p className="grid h-[300px] place-items-center text-sm text-muted">{t('solid.loading')}</p>}>
            <Solid3D kind={kind} dims={d} showHidden={showHidden} onReady={onReady} />
          </Suspense>
        </div>
        <p className="mt-1.5 text-xs text-muted">{t('solid.hint')}</p>
      </section>

      <section aria-labelledby="s-dims">
        <h2 id="s-dims" className="mb-1 text-sm font-semibold text-ink">{t('solid.size')}</h2>
        {DIM_DEFS[kind].map((def) => (
          <label key={def.key} className="flex items-center gap-3 py-1 text-sm text-ink">
            <span className="w-28 shrink-0 tabular-nums">{t(`solid.dim.${kind}.${def.key}`)} = {fmt(d[def.key])}</span>
            <input
              type="range" min={def.min} max={def.max} step={def.step}
              value={d[def.key]}
              onChange={(e) => setDim(def.key, Number(e.target.value))}
              aria-label={t(`solid.dim.${kind}.${def.key}`)}
              className="h-11 min-w-0 flex-1 accent-[var(--accent)]"
            />
          </label>
        ))}
        <button
          type="button"
          role="switch"
          aria-checked={showHidden}
          onClick={() => setShowHidden(!showHidden)}
          className="mt-1 flex h-11 w-full items-center justify-between rounded-xl px-3 text-sm text-ink transition-colors hover:bg-hover motion-reduce:transition-none"
        >
          {t('solid.hidden')}
          <span className={`relative h-6 w-11 rounded-full transition-colors motion-reduce:transition-none ${showHidden ? 'bg-accent' : 'bg-line'}`} aria-hidden="true">
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all motion-reduce:transition-none ${showHidden ? 'left-[1.375rem]' : 'left-0.5'}`} />
          </span>
        </button>
      </section>

      <dl className="space-y-1 text-sm">
        <div className="flex gap-2"><dt className="w-40 shrink-0 text-muted">{t('solid.volume')}</dt><dd className="font-mono tabular-nums text-ink">{fmt(m.volume)}</dd></div>
        <div className="flex gap-2"><dt className="w-40 shrink-0 text-muted">{t('solid.area')}</dt><dd className="font-mono tabular-nums text-ink">{fmt(m.area)}</dd></div>
      </dl>

      <div>
        <button
          type="button"
          onClick={drop}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-on-accent"
        >
          <ImagePlus size={18} aria-hidden="true" />
          {t('solid.drop')}
        </button>
        <p role="status" className="mt-1.5 min-h-[1.25rem] text-center text-xs text-muted">{dropped ? t('solid.dropped') : ''}</p>
      </div>
    </div>
  )
}
