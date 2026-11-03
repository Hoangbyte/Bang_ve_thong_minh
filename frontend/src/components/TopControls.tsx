import { useTranslation } from 'react-i18next'
import { Grid3x3, Moon, PanelRight, PenTool, Sparkles, Sun } from 'lucide-react'
import { useUiStore } from '../store/useUiStore'
import { useEditorStore, useEditorValue } from '../store/useEditorStore'
import { ChipButton, Divider, IconButton, barClass } from './ui'
import { PANEL_W } from './layout'
import { ExportMenu } from './ExportMenu'
import { FileMenu } from './FileMenu'

/** Cụm điều khiển góc trên bên phải: lưới, chế độ bút, AI làm đẹp, sáng/tối, bảng phải. */
export function TopControls() {
  const { t } = useTranslation()
  const { theme, grid, panelOpen, aiBeautify, toggleTheme, cycleGrid, togglePanel, toggleAi } = useUiStore()
  const editor = useEditorStore((s) => s.editor)
  const penMode = useEditorValue('penMode', (e) => e.getInstanceState().isPenMode, false)

  return (
    <div
      className={`${barClass} absolute top-3 transition-[right] duration-200 motion-reduce:transition-none`}
      style={{ right: panelOpen ? `calc(${PANEL_W} + 24px)` : '12px' }}
    >
      <ChipButton icon={Grid3x3} title={`${t('grid.label')}: ${t(`grid.${grid}`)} (G)`} onClick={cycleGrid}>
        {t(`grid.${grid}`)}
      </ChipButton>
      <IconButton
        icon={PenTool}
        label={t('top.penMode')}
        active={penMode}
        onClick={() => editor?.updateInstanceState({ isPenMode: !penMode })}
      />
      <ChipButton icon={Sparkles} title={`${t('top.aiHint')} (Alt+B)`} active={aiBeautify} onClick={toggleAi}>
        {t('top.ai')}
      </ChipButton>
      <FileMenu />
      <ExportMenu />
      <Divider />
      <IconButton
        icon={theme === 'dark' ? Sun : Moon}
        label={theme === 'dark' ? t('top.toLight') : t('top.toDark')}
        hint="Alt+T"
        onClick={toggleTheme}
      />
      <IconButton
        icon={PanelRight}
        label={panelOpen ? t('top.closePanel') : t('top.openPanel')}
        hint="Alt+P"
        active={panelOpen}
        onClick={togglePanel}
      />
    </div>
  )
}
