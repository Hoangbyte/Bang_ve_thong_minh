import { useTranslation } from 'react-i18next'
import { Eraser, Hand, Highlighter, MousePointer2, MoveUpRight, Pencil, Redo2, Share2, Square, Type, Undo2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEditorStore, useEditorValue } from '../store/useEditorStore'
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

  return (
    <div role="toolbar" aria-label="Công cụ vẽ" className={`${barClass} absolute bottom-4 left-1/2 -translate-x-1/2`}>
      {GROUPS.map((group, i) => (
        <div key={i} className="flex items-center gap-0.5">
          {group.map(({ id, icon, key }) => (
            <IconButton
              key={id}
              icon={icon}
              label={t(`tools.${id}`)}
              hint={key}
              active={id === 'pointLine' ? tool === 'point-line' : tool === id}
              onClick={() => editor?.setCurrentTool(id === 'pointLine' ? 'point-line' : id)}
            />
          ))}
          <Divider />
        </div>
      ))}
      <IconButton icon={Undo2} label={t('tools.undo')} hint="Ctrl+Z" disabled={!canUndo} onClick={() => editor?.undo()} />
      <IconButton icon={Redo2} label={t('tools.redo')} hint="Ctrl+Shift+Z" disabled={!canRedo} onClick={() => editor?.redo()} />
    </div>
  )
}
