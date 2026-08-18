import {
  ArrowPathIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { formatLongDate, initials } from '../../lib/formatKoreanDate'
import { useAuth } from '../../context/AuthContext'
import { useLanguageStore } from '../../stores/languageStore'
import { NotificationBell } from './NotificationBell'

function UserAvatarButton({ onClick }: { onClick: () => void }) {
  const { user } = useAuth()
  const { t } = useLanguageStore()

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('settings')}
      title={t('settings')}
      className="ml-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#121820] to-[#2a3441] text-[12px] font-bold text-white shadow-[0_6px_16px_rgba(18,24,32,0.35)] transition-all duration-150 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[#121820]/30 focus-visible:ring-offset-2 sm:ml-1"
    >
      {user ? initials(user.name) : '관'}
    </button>
  )
}

type Props = {
  title: string
  breadcrumbs?: { label: string }[]
  sidebarWidth: number
  onToggleSidebar?: () => void
  mobileMenuOpen?: boolean
  onOpenSettings?: () => void
}

export function Header({
  title,
  breadcrumbs,
  sidebarWidth,
  onToggleSidebar,
  mobileMenuOpen,
  onOpenSettings,
}: Props) {
  const { language } = useLanguageStore()

  return (
    <header
      className="fixed top-0 z-30 flex h-[60px] items-center justify-between border-b border-[#e2e8e4]/80 bg-white/80 px-3 backdrop-blur-xl transition-[left,width] duration-200 ease-out sm:h-[68px] sm:px-5"
      style={{ left: sidebarWidth, width: `calc(100% - ${sidebarWidth}px)` }}
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {onToggleSidebar ? (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-all duration-150 hover:bg-[#f0f4f1] hover:text-slate-700"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <XMarkIcon className="h-5 w-5" />
            ) : (
              <Bars3Icon className="h-5 w-5" />
            )}
          </button>
        ) : null}
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold tracking-tight text-slate-900 sm:text-[17px]">
            {title}
          </h1>
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <p className="mt-0.5 hidden truncate text-[11px] font-medium tracking-wide text-slate-400 sm:block">
              {breadcrumbs.map((b, i) => (
                <span key={i}>
                  {i > 0 ? (
                    <span className="mx-1.5 text-slate-300">/</span>
                  ) : null}
                  {b.label}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
        <time
          className="hidden rounded-full bg-[#f4f7f5] px-3 py-1.5 text-[12px] font-medium text-slate-500 md:block"
          dateTime={new Date().toISOString()}
        >
          {formatLongDate(language)}
        </time>

        <NotificationBell />

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-all duration-150 hover:bg-[#f0f4f1] hover:text-slate-700"
          title="새로고침"
          onClick={() => window.location.reload()}
        >
          <ArrowPathIcon className="h-5 w-5" />
        </button>

        <span
          className="mx-1 hidden h-5 w-px bg-[#e2e8e4] md:block"
          aria-hidden
        />

        <UserAvatarButton onClick={() => onOpenSettings?.()} />
      </div>
    </header>
  )
}
