import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { SettingsPanel } from './SettingsPanel'
import { SupportFab } from './SupportFab'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { useLanguageStore } from '../../stores/languageStore'
import { useMapReportStore } from '../../stores/mapReportStore'
import type { TranslationKey } from '../../i18n/translations'

const COLLAPSE_KEY = 'gc-sidebar-collapsed'

type RouteMap = Record<
  string,
  { titleKey: TranslationKey; crumbs?: TranslationKey[] }
>

const ROUTE_MAP: RouteMap = {
  '/': { titleKey: 'dashboard', crumbs: ['home', 'overview'] },
  '/daily-plans': { titleKey: 'workReports', crumbs: ['operations', 'workReports'] },
  '/report-history': {
    titleKey: 'reportHistory',
    crumbs: ['operations', 'reportHistory'],
  },
  '/drone-scans': { titleKey: 'droneScan', crumbs: ['analysis', 'droneScan'] },
  '/issues': { titleKey: 'issueManagement', crumbs: ['operations', 'issues'] },
  '/journal': { titleKey: 'workJournal', crumbs: ['records', 'workJournal'] },
  '/notifications': { titleKey: 'notifications', crumbs: ['notifications'] },
  '/course-map': { titleKey: 'courseMap', crumbs: ['operations', 'courseMap'] },
  '/ai': { titleKey: 'aiAssistant', crumbs: ['operations', 'aiAssistant'] },
  '/inventory': { titleKey: 'inventory', crumbs: ['operations', 'inventory'] },
  '/workers': { titleKey: 'workers', crumbs: ['operations', 'workers'] },
  '/settings': { titleKey: 'settings', crumbs: ['settings'] },
  '/support': { titleKey: 'support', crumbs: ['support'] },
  '/pending-approvals': {
    titleKey: 'pendingApprovals',
    crumbs: ['operations', 'pendingApprovals'],
  },
}

export function AppLayout() {
  const breakpoint = useBreakpoint()
  const isMobile = breakpoint === 'mobile'
  const [manualCollapsed, setManualCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY)
      if (stored === '1') return true
      if (stored === '0') return false
    } catch {
      /* ignore */
    }
    // Default: icon rail on tablet-width and below desktop preference
    return typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 1023px)').matches
      : false
  })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const { t } = useLanguageStore()
  const { pathname } = useLocation()
  const route =
    ROUTE_MAP[pathname] ??
    (pathname.startsWith('/report-history/')
      ? {
          titleKey: 'reportDetail' as TranslationKey,
          crumbs: ['operations', 'reportHistory', 'reportDetail'] as TranslationKey[],
        }
      : ROUTE_MAP['/'])

  // mobile: drawer overlay (0 inset) · tablet/laptop/desktop: rail or full
  const railCollapsed = !isMobile && manualCollapsed
  const sidebarPx = isMobile ? 0 : railCollapsed ? 64 : 260

  const title = t(route.titleKey)
  const breadcrumbs = route.crumbs?.map((key) => ({ label: t(key) }))

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isMobile) setMobileNavOpen(false)
  }, [isMobile])

  // One-time local map-PDF migration dry-run (logs count; never uploads).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      useMapReportStore.getState().runMigrationDryRun()
    }, 400)
    return () => window.clearTimeout(timer)
  }, [])

  // Available to portaled UI (modals) outside this tree
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--gc-sidebar-width',
      `${sidebarPx}px`,
    )
  }, [sidebarPx])

  function handleToggle() {
    if (isMobile) {
      setMobileNavOpen((open) => !open)
      return
    }
    setManualCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <div className="relative min-h-screen bg-[#eef2ef] font-sans antialiased">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(45,90,39,0.06),_transparent_45%),radial-gradient(ellipse_at_bottom_left,_rgba(18,24,32,0.04),_transparent_40%)]"
        aria-hidden
      />

      {isMobile && mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px]"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <Sidebar
        collapsed={railCollapsed}
        mobileOverlay={isMobile}
        mobileOpen={mobileNavOpen}
        onToggle={isMobile ? undefined : handleToggle}
        onNavigate={() => setMobileNavOpen(false)}
      />
      <Header
        title={title}
        breadcrumbs={breadcrumbs}
        sidebarWidth={sidebarPx}
        onToggleSidebar={handleToggle}
        mobileMenuOpen={isMobile ? mobileNavOpen : undefined}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <main
        className="page-enter relative min-h-screen pt-[60px] transition-[padding-left] duration-200 ease-out sm:pt-[68px]"
        style={{ paddingLeft: sidebarPx }}
      >
        <div className="p-3 sm:p-5 md:p-6 xl:p-8">
          <Outlet />
        </div>
      </main>
      <SupportFab />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
