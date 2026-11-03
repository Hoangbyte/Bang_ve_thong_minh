import { useEffect } from 'react'
import { Tldraw, type TLComponents } from 'tldraw'
import { useTranslation } from 'react-i18next'
import { useUiStore } from './store/useUiStore'
import { useEditorStore } from './store/useEditorStore'
import { useShortcuts } from './hooks/useShortcuts'
import { useAutoBeautify } from './hooks/useAutoBeautify'
import { useGeometryLinks } from './hooks/useGeometryLinks'
import { SnapFeedback } from './components/SnapFeedback'
import { GridBackground } from './components/GridBackground'
import { Toolbar } from './components/Toolbar'
import { TopControls } from './components/TopControls'
import { ZoomControls } from './components/ZoomControls'
import { RightPanel } from './components/RightPanel'
import { PagesMenu } from './components/PagesMenu'
import { GraphShapeUtil } from './graph/GraphShape'
import { PointLineTool } from './geometry/PointLineTool'

// Tắt toàn bộ giao diện mặc định của tldraw để dùng giao diện riêng; vẫn giữ phím tắt và menu chuột phải.
const components: TLComponents = {
  Toolbar: null, HelpMenu: null, ZoomMenu: null, MainMenu: null, Minimap: null,
  StylePanel: null, PageMenu: null, NavigationPanel: null, MenuPanel: null,
  TopPanel: null, SharePanel: null, ActionsMenu: null, QuickActions: null,
  DebugPanel: null, DebugMenu: null, KeyboardShortcutsDialog: null,
  Grid: GridBackground,
}

export default function App() {
  const { t } = useTranslation()
  const theme = useUiStore((s) => s.theme)
  const grid = useUiStore((s) => s.grid)
  const editor = useEditorStore((s) => s.editor)
  const setEditor = useEditorStore((s) => s.setEditor)
  useShortcuts()
  useAutoBeautify()
  useGeometryLinks()

  // Đồng bộ sáng/tối cho cả giao diện riêng lẫn tldraw
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    editor?.user.updateUserPreferences({ colorScheme: theme })
  }, [theme, editor])

  // Bật/tắt lưới của tldraw theo lựa chọn (kiểu lưới do GridBackground vẽ)
  useEffect(() => {
    editor?.updateInstanceState({ isGridMode: grid !== 'none' })
  }, [grid, editor])

  return (
    <div className="fixed inset-0">
      {/* persistenceKey: tldraw tự lưu nội dung bảng cục bộ (IndexedDB) và khôi phục khi mở lại */}
      <Tldraw
        persistenceKey="bang-thong-minh"
        components={components}
        shapeUtils={[GraphShapeUtil]}
        tools={[PointLineTool]}
        onMount={(e) => {
          setEditor(e)
          return () => setEditor(null)
        }}
      />
      <div className="ui-layer pointer-events-none absolute inset-0 z-[1000] font-sans text-ink">
        <div className="absolute left-4 top-3 flex items-center gap-2">
          <div className="pointer-events-auto flex h-[3.25rem] items-center gap-2 rounded-2xl border border-line bg-surface px-3 text-sm font-semibold shadow-ui">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden="true" />
            <span className="hidden sm:inline">{t('app.name')}</span>
          </div>
          <PagesMenu />
        </div>
        <TopControls />
        <ZoomControls />
        <SnapFeedback />
        <Toolbar />
        <RightPanel />
      </div>
    </div>
  )
}
