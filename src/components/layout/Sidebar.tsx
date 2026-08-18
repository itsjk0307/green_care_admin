import { NavLink, useLocation } from 'react-router-dom'
import {
  ArchiveBoxIcon,
  BellIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  Cog6ToothIcon,
  HomeIcon,
  MapIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { AiSparkleIcon } from '../icons/AiSparkleIcon'
import { useAuth } from '../../context/AuthContext'
import { isAdminRole } from '../../lib/roles'
import { useLanguageStore } from '../../stores/languageStore'
import type { TranslationKey } from '../../i18n/translations'

type NavIcon = React.ComponentType<{ className?: string; title?: string }>

type NavItem = {
  to: string
  labelKey: TranslationKey
  Icon: NavIcon
  /** Keep brand / gradient colors (don't mute inactive state) */
  keepIconColor?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'dashboard', Icon: HomeIcon },
  {
    to: '/daily-plans',
    labelKey: 'workReports',
    Icon: ClipboardDocumentListIcon,
  },
  {
    to: '/report-history',
    labelKey: 'reportHistory',
    Icon: ClockIcon,
  },
  {
    to: '/course-map',
    labelKey: 'courseMap',
    Icon: MapIcon,
  },
  {
    to: '/inventory',
    labelKey: 'inventory',
    Icon: ArchiveBoxIcon,
  },
  {
    to: '/workers',
    labelKey: 'workers',
    Icon: UserGroupIcon,
  },
  {
    to: '/ai',
    labelKey: 'aiAssistant',
    Icon: AiSparkleIcon,
    keepIconColor: true,
  },
  {
    to: '/notifications',
    labelKey: 'notifications',
    Icon: BellIcon,
  },
  {
    to: '/settings',
    labelKey: 'settings',
    Icon: Cog6ToothIcon,
  },
]

const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    to: '/pending-approvals',
    labelKey: 'pendingApprovals',
    Icon: UserGroupIcon,
  },
]

type Props = {
  collapsed: boolean
  /** Phone: drawer overlay instead of pushing content */
  mobileOverlay?: boolean
  mobileOpen?: boolean
  onToggle?: () => void
  onNavigate?: () => void
}

function pathActive(pathname: string, to: string) {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function Sidebar({
  collapsed,
  mobileOverlay = false,
  mobileOpen = false,
  onToggle,
  onNavigate,
}: Props) {
  const { pathname } = useLocation()
  const { t } = useLanguageStore()
  const { user } = useAuth()

  const navItems = isAdminRole(user?.role)
    ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS]
    : NAV_ITEMS

  const showLabels = mobileOverlay ? true : !collapsed
  const widthClass = mobileOverlay
    ? 'w-[min(280px,85vw)]'
    : collapsed
      ? 'w-16'
      : 'w-[260px]'

  return (
    <aside
      className={`fixed left-0 top-0 z-50 flex h-screen flex-col bg-sidebar transition-[width,transform] duration-200 ease-out ${widthClass} ${
        mobileOverlay
          ? mobileOpen
            ? 'translate-x-0 shadow-[var(--shadow-gc-modal)]'
            : '-translate-x-full'
          : 'translate-x-0'
      }`}
      aria-hidden={mobileOverlay && !mobileOpen ? true : undefined}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,_rgba(74,138,66,0.22),_transparent_70%)]"
        aria-hidden
      />

      <div
        className={`relative flex h-[60px] shrink-0 items-center sm:h-[72px] ${
          showLabels ? 'gap-3 px-5' : 'justify-center px-2'
        }`}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.35)] ring-1 ring-white/15">
          <img
            src="/logo.png"
            alt="대정골프"
            className="h-full w-full object-cover object-left"
          />
        </div>
        {showLabels ? (
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-tight text-white">
              GreenCare
            </p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
              Operations
            </p>
          </div>
        ) : null}
      </div>

      <nav className="relative flex-1 overflow-y-auto px-3 pb-4 pt-1">
        {showLabels ? (
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
            {t('menu')}
          </p>
        ) : null}
        <ul className="space-y-0.5">
          {navItems.map(({ to, labelKey, Icon, keepIconColor }) => {
            const active = pathActive(pathname, to)
            const label = t(labelKey)
            return (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  title={!showLabels ? label : undefined}
                  onClick={() => onNavigate?.()}
                  className={`group relative flex h-11 items-center gap-3 rounded-lg text-[13px] transition-colors duration-150 sm:h-10 ${
                    showLabels ? 'px-3' : 'justify-center px-0'
                  } ${
                    active
                      ? 'bg-white/[0.06] font-medium text-white'
                      : 'font-normal text-white/50 hover:bg-white/[0.04] hover:text-white/80'
                  }`}
                >
                  {active ? (
                    <span
                      className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-brand-light/80"
                      aria-hidden
                    />
                  ) : null}
                  <Icon
                    className={
                      keepIconColor
                        ? 'h-[22px] w-[22px] shrink-0'
                        : `h-[18px] w-[18px] shrink-0 transition-colors ${
                            active
                              ? 'text-brand-light'
                              : 'text-white/45 group-hover:text-white/75'
                          }`
                    }
                  />
                  {showLabels ? (
                    <span className="truncate tracking-[-0.01em]">{label}</span>
                  ) : null}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      {onToggle ? (
        <div className="relative border-t border-white/10 p-3">
          <button
            type="button"
            onClick={onToggle}
            title={collapsed ? t('expandMenu') : t('collapseMenu')}
            aria-label={collapsed ? t('expandMenu') : t('collapseMenu')}
            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-medium text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white ${
              !showLabels ? 'justify-center px-0' : ''
            }`}
          >
            {!showLabels ? (
              <ChevronRightIcon className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeftIcon className="h-4 w-4" />
                <span>{t('collapseMenu')}</span>
              </>
            )}
          </button>
        </div>
      ) : null}
    </aside>
  )
}
