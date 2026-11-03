import { useTranslation } from 'react-i18next'
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react'
import { useEditorStore, useEditorValue } from '../store/useEditorStore'
import { IconButton, barClass } from './ui'

export function ZoomControls() {
  const { t } = useTranslation()
  const editor = useEditorStore((s) => s.editor)
  const zoom = useEditorValue('zoom', (e) => Math.round(e.getZoomLevel() * 100), 100)

  return (
    <div className={`${barClass} absolute bottom-4 left-4`}>
      <IconButton icon={ZoomOut} label={t('zoom.out')} onClick={() => editor?.zoomOut()} />
      <button
        type="button"
        title={t('zoom.reset')}
        aria-label={t('zoom.reset')}
        onClick={() => editor?.resetZoom()}
        className="h-11 min-w-[3.5rem] rounded-xl px-2 text-sm font-medium tabular-nums text-ink transition-colors hover:bg-hover motion-reduce:transition-none"
      >
        {zoom}%
      </button>
      <IconButton icon={ZoomIn} label={t('zoom.in')} onClick={() => editor?.zoomIn()} />
      <IconButton icon={Maximize} label={t('zoom.fit')} onClick={() => editor?.zoomToFit()} />
    </div>
  )
}
