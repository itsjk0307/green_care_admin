import { NavLink, useLocation } from 'react-router-dom'
import {
  BeakerIcon,
  BellIcon,
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  HomeIcon,
  MapIcon,
  MapPinIcon,
  PhotoIcon,
  RectangleStackIcon,
} from '@heroicons/react/24/outline'
import { useLanguageStore } from '../../stores/languageStore'
import type { TranslationKey } from '../../i18n/translations'

type NavItem = {
  to: string
  labelKey: TranslationKey
  icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { title?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'dashboard', icon: HomeIcon },
  { to: '/work-reports', labelKey: 'workReports', icon: ClipboardDocumentCheckIcon },
  { to: '/daily-plans', labelKey: 'dailyPlan', icon: ClipboardDocumentListIcon },
  { to: '/disease-reports', labelKey: 'diseaseAnalysis', icon: BeakerIcon },
  { to: '/drone-scans', labelKey: 'droneScan', icon: PhotoIcon },
  { to: '/issues', labelKey: 'issueManagement', icon: MapPinIcon },
  { to: '/photo-box', labelKey: 'photobox', icon: RectangleStackIcon },
  { to: '/journal', labelKey: 'workJournal', icon: BookOpenIcon },
  { to: '/notifications', labelKey: 'notifications', icon: BellIcon },
  { to: '/course-map', labelKey: 'courseMap', icon: MapIcon },
]

type Props = {
  collapsed: boolean
  onToggle?: () => void
}

function pathActive(pathname: string, to: string) {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function Sidebar({ collapsed, onToggle }: Props) {
  const { pathname } = useLocation()
  const { t } = useLanguageStore()

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-slate-100 bg-white transition-[width] duration-200 ease-out ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* ── Logo ── */}
      <div
        className={`flex h-[60px] shrink-0 items-center border-b border-slate-100 ${
          collapsed ? 'justify-center px-3' : 'gap-2.5 px-4'
        }`}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-[15px]">
          ⛳
        </div>
        {!collapsed ? (
          <>
            <span className="flex-1 text-[15px] font-bold text-slate-900">GreenCare</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              {t('adminLabel')}
            </span>
          </>
        ) : null}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {!collapsed ? (
          <p className="mb-1 px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {t('menu')}
          </p>
        ) : null}
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => {
            const active = pathActive(pathname, to)
            const label = t(labelKey)
            return (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  title={collapsed ? label : undefined}
                  className={`flex h-10 items-center gap-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    collapsed ? 'justify-center px-0' : 'px-3'
                  } ${
                    active
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-white' : ''}`} />
                  {!collapsed ? <span className="truncate">{label}</span> : null}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* ── Collapse toggle (desktop only) ── */}
      {onToggle ? (
        <div className="flex justify-center border-t border-slate-100 p-2">
          <button
            type="button"
            onClick={onToggle}
            title={collapsed ? t('expandMenu') : t('collapseMenu')}
            aria-label={collapsed ? t('expandMenu') : t('collapseMenu')}
            className="rounded-xl p-2 text-slate-400 transition-all duration-150 hover:bg-slate-100 hover:text-slate-600"
          >
            {collapsed ? (
              <ChevronRightIcon className="h-4 w-4" />
            ) : (
              <ChevronLeftIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      ) : null}
    </aside>
  )
}
