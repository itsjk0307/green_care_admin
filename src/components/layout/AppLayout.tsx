import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useLanguageStore } from '../../stores/languageStore'
import type { TranslationKey } from '../../i18n/translations'

const COLLAPSE_KEY = 'gc-sidebar-collapsed'

type RouteMap = Record<
  string,
  { titleKey: TranslationKey; crumbs?: TranslationKey[] }
>

const ROUTE_MAP: RouteMap = {
  '/': { titleKey: 'dashboard', crumbs: ['home', 'overview'] },
  '/work-reports': { titleKey: 'workReports', crumbs: ['operations', 'workReports'] },
  '/daily-plans': { titleKey: 'dailyPlan', crumbs: ['operations', 'dailyPlan'] },
  '/disease-reports': {
    titleKey: 'diseaseAnalysis',
    crumbs: ['analysis', 'diseaseDetection'],
  },
  '/drone-scans': { titleKey: 'droneScan', crumbs: ['analysis', 'droneScan'] },
  '/issues': { titleKey: 'issueManagement', crumbs: ['operations', 'issues'] },
  '/photo-box': { titleKey: 'photobox', crumbs: ['media', 'photobox'] },
  '/journal': { titleKey: 'workJournal', crumbs: ['records', 'workJournal'] },
  '/notifications': { titleKey: 'notifications', crumbs: ['notifications'] },
  '/course-map': { titleKey: 'courseMap', crumbs: ['operations', 'courseMap'] },
}

export function AppLayout() {
  const narrow = useMediaQuery('(max-width: 1023px)')
  const [manualCollapsed, setManualCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })

  const { t } = useLanguageStore()
  const collapsed = narrow || manualCollapsed
  const sidebarPx = collapsed ? 64 : 240
  const { pathname } = useLocation()
  const route = ROUTE_MAP[pathname] ?? ROUTE_MAP['/']

  const title = t(route.titleKey)
  const breadcrumbs = route.crumbs?.map((key) => ({ label: t(key) }))

  function handleToggle() {
    setManualCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {}
      return next
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased">
      <Sidebar collapsed={collapsed} onToggle={narrow ? undefined : handleToggle} />
      <Header
        title={title}
        breadcrumbs={breadcrumbs}
        sidebarWidth={sidebarPx}
        onToggleSidebar={handleToggle}
      />
      <main
        className="page-enter min-h-screen pt-[60px] transition-[padding-left] duration-200 ease-out"
        style={{ paddingLeft: sidebarPx }}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
