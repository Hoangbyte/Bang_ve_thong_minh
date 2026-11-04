import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Eraser, Hand, Highlighter, MousePointer2, MoveUpRight, Pencil, Redo2, Share2, Square, Type, Undo2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEditorStore, useEditorValue } from '../store/useEditorStore'
import { setGeometryDrawMode, type GeometryDrawMode } from '../geometry/ShapeDrawTool'
import { Divider, IconButton, barClass } from './ui'

// Phím tắt lấy theo tldraw, chỉ hiển thị trong tooltip.
const GROUPS: { id: string; icon: LucideIcon; key: string }[][] = [
  [{ id: 'select', icon: MousePointer2, key: 'V' }, { id: 'hand', icon: Hand, key: 'H' }],
  [
    { id: 'draw', icon: Pencil, key: 'D' },
    { id: 'highlight', icon: Highlighter, key: 'Shift+D' },
    { id: 'eraser', icon: Eraser, key: 'E' },
  ],
  [
    { id: 'geo', icon: Square, key: 'R' },
    { id: 'pointLine', icon: Share2, key: 'Esc' },
    { id: 'arrow', icon: MoveUpRight, key: 'A' },
    { id: 'text', icon: Type, key: 'T' },
  ],
]

/** Thanh công cụ nổi ở đáy màn hình, tầm với của ngón cái trên tablet. */
export function Toolbar() {
  const { t } = useTranslation()
  const editor = useEditorStore((s) => s.editor)
  const tool = useEditorValue('tool', (e) => e.getCurrentToolId(), 'select')
  const canUndo = useEditorValue('canUndo', (e) => e.getCanUndo(), false)
  const canRedo = useEditorValue('canRedo', (e) => e.getCanRedo(), false)
  const [lineMode, setLineMode] = useState<GeometryDrawMode>('vector')
  const [shapeMode, setShapeMode] = useState<GeometryDrawMode>('circle')

  const activateTool = (id: string) => {
    editor?.updateInstanceState({ isToolLocked: ['geo', 'arrow', 'point-line'].includes(id) })
    editor?.setCurrentTool(id)
  }

  const activateGeometry = (mode: GeometryDrawMode) => {
    setShapeMode(mode)
    setGeometryDrawMode(mode)
    editor?.updateInstanceState({ isToolLocked: true })
    editor?.setCurrentTool('geometry-draw')
  }

  const activateLine = (mode: GeometryDrawMode) => {
    setLineMode(mode)
    setGeometryDrawMode(mode)
    editor?.updateInstanceState({ isToolLocked: true })
    editor?.setCurrentTool('geometry-draw')
  }

  return (
    <div role="toolbar" aria-label="Công cụ vẽ" className={`${barClass} absolute bottom-4 left-1/2 z-[1100] -translate-x-1/2`}>
      {GROUPS.map((group, i) => (
        <div key={i} className="flex items-center gap-0.5">
          {group.map(({ id, icon, key }) => (
            id === 'geo' ? (
              <div key={id} className="flex items-center">
                <IconButton
                  icon={icon}
                  label={t(`tools.${id}`)}
                  hint={key}
                  active={tool === 'geo' || (tool === 'geometry-draw' && (shapeMode === 'circle' || shapeMode === 'ellipse'))}
                  onClick={() => activateTool('geo')}
                />
                <ModeMenu
                  label={t('tools.geometryMenu')}
                  options={[
                    { mode: 'circle', label: t('tools.circle') },
                    { mode: 'ellipse', label: t('tools.ellipse') },
                  ]}
                  selectedMode={shapeMode}
                  active={tool === 'geometry-draw' && (shapeMode === 'circle' || shapeMode === 'ellipse')}
                  onSelect={activateGeometry}
                />
              </div>
            ) : id === 'arrow' ? (
              <div key={id} className="flex items-center">
                <IconButton
                  icon={icon}
                  label={t('tools.arrow')}
                  hint={key}
                  active={tool === 'geometry-draw' && (lineMode === 'vector' || lineMode === 'line' || lineMode === 'dashed-line')}
                  onClick={() => activateLine('vector')}
                />
                <ModeMenu
                  label={t('tools.lineMenu')}
                  options={[
                    { mode: 'vector', label: t('tools.vector') },
                    { mode: 'line', label: t('tools.straightLine') },
                    { mode: 'dashed-line', label: t('tools.dashedLine') },
                  ]}
                  selectedMode={lineMode}
                  active={tool === 'geometry-draw' && (lineMode === 'vector' || lineMode === 'line' || lineMode === 'dashed-line')}
                  onSelect={activateLine}
                />
              </div>
            ) : (
              <IconButton
                key={id}
                icon={icon}
                label={t(`tools.${id}`)}
                hint={key}
                active={id === 'pointLine' ? tool === 'point-line' : tool === id}
                onClick={() => activateTool(id === 'pointLine' ? 'point-line' : id)}
              />
            )
          ))}
          <Divider />
        </div>
      ))}
      <IconButton icon={Undo2} label={t('tools.undo')} hint="Ctrl+Z" disabled={!canUndo} onClick={() => editor?.undo()} />
      <IconButton icon={Redo2} label={t('tools.redo')} hint="Ctrl+Shift+Z" disabled={!canRedo} onClick={() => editor?.redo()} />
    </div>
  )
}

function ModeMenu(props: {
  label: string
  options: { mode: GeometryDrawMode; label: string }[]
  selectedMode: GeometryDrawMode
  active: boolean
  onSelect: (mode: GeometryDrawMode) => void
}) {
  const { label, options, selectedMode, active, onSelect } = props
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  return (
    <div ref={rootRef} className="relative -ml-1">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`grid h-8 w-6 place-items-center rounded-lg transition-colors motion-reduce:transition-none ${
          active ? 'text-accent' : 'text-ink hover:bg-hover'
        }`}
      >
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" aria-label={label} className="absolute bottom-[calc(100%+8px)] left-0 z-[1100] min-w-40 rounded-xl border border-line bg-surface p-1 shadow-ui">
          {options.map((option) => (
            <button
              key={option.mode}
              type="button"
              role="menuitemradio"
              aria-checked={selectedMode === option.mode}
              onClick={() => {
                onSelect(option.mode)
                setOpen(false)
              }}
              className={`flex h-10 w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 text-left text-sm transition-colors hover:bg-hover motion-reduce:transition-none ${
                selectedMode === option.mode ? 'text-accent' : 'text-ink'
              }`}
            >
              <span className="grid w-4 place-items-center">{selectedMode === option.mode && <Check size={14} aria-hidden="true" />}</span>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
