import { useTranslation } from 'react-i18next'
import { DefaultColorStyle, DefaultDashStyle, DefaultSizeStyle } from 'tldraw'
import { Trash2 } from 'lucide-react'
import { useUiStore, type PanelTab } from '../store/useUiStore'
import { useEditorStore, useEditorValue } from '../store/useEditorStore'
import { getGeometryEdge } from '../geometry/PointLineTool'
import { ChatPanel } from './ChatPanel'
import { ErrorBoundary } from './ErrorBoundary'
import { GraphPanel } from './GraphPanel'
import { SolidPanel } from './SolidPanel'
import { PANEL_W } from './layout'

const TABS: PanelTab[] = ['ai', 'graph', 'solid', 'props']
const COLORS = [
  { id: 'black', hex: '#1d1d1d' }, { id: 'blue', hex: '#4465e9' }, { id: 'red', hex: '#e03131' },
  { id: 'green', hex: '#099268' }, { id: 'orange', hex: '#e16919' }, { id: 'violet', hex: '#ae3ec9' },
  { id: 'yellow', hex: '#f1ac4b' },
] as const
const SIZES = ['s', 'm', 'l', 'xl'] as const

/** Bảng bên phải: Trợ lý AI | Đồ thị | Thuộc tính. Hai tab đầu là khung chờ cho giai đoạn sau. */
export function RightPanel() {
  const { t } = useTranslation()
  const { panelOpen, tab, setTab } = useUiStore()

  return (
    <aside
      aria-hidden={!panelOpen}
      className={`pointer-events-auto absolute bottom-3 right-3 top-3 flex flex-col rounded-2xl border border-line bg-surface shadow-ui transition-[transform,visibility] duration-200 motion-reduce:transition-none ${
        panelOpen ? '' : 'invisible translate-x-[calc(100%+24px)]'
      }`}
      style={{ width: PANEL_W }}
    >
      <div role="tablist" className="flex gap-1 border-b border-line p-2">
        {TABS.map((id) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setTab(id)}
            className={`h-10 min-w-0 flex-1 truncate rounded-lg px-1 text-[13px] font-medium transition-colors motion-reduce:transition-none ${
              tab === id ? 'bg-accent text-on-accent' : 'text-ink hover:bg-hover'
            }`}
          >
            {t(`panel.tabs.${id}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'ai' && <ErrorBoundary><ChatPanel /></ErrorBoundary>}
        {tab === 'graph' && <ErrorBoundary><GraphPanel /></ErrorBoundary>}
        {tab === 'solid' && <ErrorBoundary><SolidPanel /></ErrorBoundary>}
        {tab === 'props' && <StyleControls />}
      </div>
    </aside>
  )
}

/** Chỉnh màu và độ dày: áp cho nét sắp vẽ và cho các hình đang chọn. */
function StyleControls() {
  const { t } = useTranslation()
  const editor = useEditorStore((s) => s.editor)
  const color = useEditorValue<string | undefined>(
    'styleColor',
    (e) => {
      const s = e.getSharedStyles().get(DefaultColorStyle)
      return s?.type === 'shared' ? s.value : undefined
    },
    undefined
  )
  const size = useEditorValue<string | undefined>(
    'styleSize',
    (e) => {
      const s = e.getSharedStyles().get(DefaultSizeStyle)
      return s?.type === 'shared' ? s.value : undefined
    },
    undefined
  )
  const dash = useEditorValue<string | undefined>(
    'styleDash',
    (e) => {
      const style = e.getSharedStyles().get(DefaultDashStyle)
      return style?.type === 'shared' ? style.value : undefined
    },
    undefined
  )
  const selectedEdges = useEditorValue(
    'selectedGeometryEdges',
    (e) => e.getSelectedShapes().filter((shape) => !!getGeometryEdge(shape)),
    []
  )

  return (
    <div className="space-y-6">
      <BeautifyOptions />
      <section aria-labelledby="lbl-color">
        <h2 id="lbl-color" className="mb-2 text-sm font-semibold text-ink">{t('panel.color')}</h2>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              title={t(`panel.colors.${c.id}`)}
              aria-label={t(`panel.colors.${c.id}`)}
              aria-pressed={color === c.id}
              onClick={() =>
                editor?.run(() => {
                  editor.setStyleForNextShapes(DefaultColorStyle, c.id)
                  editor.setStyleForSelectedShapes(DefaultColorStyle, c.id)
                })
              }
              className="grid h-11 w-11 place-items-center rounded-full border-2"
              style={{ borderColor: color === c.id ? 'var(--accent)' : 'var(--line)' }}
            >
              <span className="h-6 w-6 rounded-full" style={{ background: c.hex }} />
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="lbl-size">
        <h2 id="lbl-size" className="mb-2 text-sm font-semibold text-ink">{t('panel.size')}</h2>
        <div className="grid grid-cols-4 gap-2">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={size === s}
              onClick={() =>
                editor?.run(() => {
                  editor.setStyleForNextShapes(DefaultSizeStyle, s)
                  editor.setStyleForSelectedShapes(DefaultSizeStyle, s)
                })
              }
              className={`h-11 rounded-xl text-sm font-medium transition-colors motion-reduce:transition-none ${
                size === s ? 'bg-accent text-on-accent' : 'border border-line text-ink hover:bg-hover'
              }`}
            >
              {t(`panel.sizes.${s}`)}
            </button>
          ))}
        </div>
      </section>

      {selectedEdges.length > 0 && (
        <>
          <section aria-labelledby="lbl-dash">
            <h2 id="lbl-dash" className="mb-2 text-sm font-semibold text-ink">{t('panel.lineStyle')}</h2>
            <div className="grid grid-cols-3 gap-2">
              {(['solid', 'dashed', 'dotted'] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  aria-pressed={dash === style}
                  onClick={() => editor?.setStyleForSelectedShapes(DefaultDashStyle, style)}
                  className={`h-11 rounded-xl text-sm font-medium transition-colors motion-reduce:transition-none ${
                    dash === style ? 'bg-accent text-on-accent' : 'border border-line text-ink hover:bg-hover'
                  }`}
                >
                  {t(`panel.lineStyles.${style}`)}
                </button>
              ))}
            </div>
          </section>
          <button
            type="button"
            onClick={() => editor?.deleteShapes(selectedEdges.map((shape) => shape.id))}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line text-sm font-medium text-ink transition-colors hover:bg-hover motion-reduce:transition-none"
          >
            <Trash2 size={17} aria-hidden="true" />
            {t('panel.deleteEdge')}
          </button>
        </>
      )}
    </div>
  )
}

/** Tuỳ chọn khi làm đẹp đa giác: nhãn đỉnh và ký hiệu góc vuông. */
function BeautifyOptions() {
  const { t } = useTranslation()
  const { labelVertices, rightAngles, toggleLabelVertices, toggleRightAngles } = useUiStore()
  const rows = [
    { id: 'labels', text: t('panel.labelVertices'), on: labelVertices, toggle: toggleLabelVertices },
    { id: 'right', text: t('panel.rightAngles'), on: rightAngles, toggle: toggleRightAngles },
  ]
  return (
    <section aria-labelledby="lbl-beautify">
      <h2 id="lbl-beautify" className="mb-2 text-sm font-semibold text-ink">{t('panel.beautify')}</h2>
      <div className="space-y-1">
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            role="switch"
            aria-checked={r.on}
            onClick={r.toggle}
            className="flex h-11 w-full items-center justify-between rounded-xl px-3 text-sm text-ink transition-colors hover:bg-hover motion-reduce:transition-none"
          >
            {r.text}
            <span className={`relative h-6 w-11 rounded-full transition-colors motion-reduce:transition-none ${r.on ? 'bg-accent' : 'bg-line'}`} aria-hidden="true">
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all motion-reduce:transition-none ${r.on ? 'left-[1.375rem]' : 'left-0.5'}`} />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
