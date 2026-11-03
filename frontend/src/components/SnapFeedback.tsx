import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Undo2 } from 'lucide-react'
import { useSnapStore } from '../store/useSnapStore'
import { useEditorStore } from '../store/useEditorStore'

/** Hiệu ứng snap (nét gốc mờ dần, khung quanh hình mới) và thông báo kèm độ tin cậy + nút hoàn tác. */
export function SnapFeedback() {
  const { t } = useTranslation()
  const event = useSnapStore((s) => s.event)
  const setEvent = useSnapStore((s) => s.setEvent)
  const editor = useEditorStore((s) => s.editor)

  // Tự ẩn thông báo sau vài giây
  useEffect(() => {
    if (!event) return
    const timer = setTimeout(() => setEvent(null), 6000)
    return () => clearTimeout(timer)
  }, [event, setEvent])

  if (!event) return null
  const percent = Math.round(event.confidence * 100)
  const snapped = event.status === 'snapped'
  const message = snapped
    ? t('snap.done', { shape: t(`shapes.${event.shapeKey}`) })
    : event.confidence > 0.25
      ? t('snap.keptUnsure')
      : t('snap.keptUnknown')

  return (
    <>
      {snapped && (
        <svg key={event.key} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {event.ghost && <path d={event.ghost} fill="none" stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="snap-ghost" />}
          {event.box && (
            <rect
              x={event.box.x - 6} y={event.box.y - 6} width={event.box.w + 12} height={event.box.h + 12}
              rx={8} fill="none" stroke="var(--accent)" strokeWidth={2} className="snap-box"
              style={{ transformBox: 'fill-box' }}
            />
          )}
        </svg>
      )}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-line bg-surface py-2 pl-4 pr-2 text-sm shadow-ui"
      >
        <div>
          <p className="font-medium text-ink">{message}</p>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-line" aria-hidden="true">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
            </span>
            {t('snap.confidence', { percent })}
          </div>
        </div>
        {snapped && (
          <button
            type="button"
            onClick={() => { editor?.undo(); setEvent(null) }}
            className="flex h-10 items-center gap-1.5 rounded-xl px-3 font-medium text-ink transition-colors hover:bg-hover motion-reduce:transition-none"
          >
            <Undo2 size={16} aria-hidden="true" />
            {t('snap.undo')}
          </button>
        )}
      </div>
    </>
  )
}
