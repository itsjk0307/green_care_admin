import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useMediaQuery } from '../../hooks/useMediaQuery'

const titles: Record<string, { title: string; crumbs?: { label: string }[] }> = {
  '/': { title: '대시보드', crumbs: [{ label: '홈' }, { label: '개요' }] },
  '/work-reports': {
    title: '작업 보고서',
    crumbs: [{ label: '운영' }, { label: '작업 보고서' }],
  },
  '/disease-reports': {
    title: '질병 분석',
    crumbs: [{ label: '분석' }, { label: '질병 탐지' }],
  },
}

export function AppLayout() {
  const narrow = useMediaQuery('(max-width: 1023px)')
  const collapsed = narrow
  const sidebarPx = collapsed ? 72 : 256
  const { pathname } = useLocation()
  const meta = titles[pathname] ?? titles['/']

  return (
    <div className="min-h-screen bg-[#F7F8F7] font-sans antialiased">
      <Sidebar collapsed={collapsed} />
      <Header
        title={meta.title}
        breadcrumbs={meta.crumbs}
        sidebarWidth={sidebarPx}
      />
      <main
        className="page-enter min-h-screen pt-[60px] transition-[padding] duration-150"
        style={{ paddingLeft: sidebarPx }}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
