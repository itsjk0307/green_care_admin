import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowPathIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'
import { formatKoreanLongDate, initials } from '../../lib/formatKoreanDate'
import { useAuth } from '../../context/AuthContext'
import { useLanguageStore } from '../../stores/languageStore'
import { NotificationBell } from './NotificationBell'

// ── Premium Profile Dropdown ──────────────────────────────────────────────────

function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { t, language, setLanguage } = useLanguageStore()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative ml-1">
      {/* ── Avatar trigger ── */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        aria-label="사용자 메뉴"
        className={`flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white ring-offset-white transition-all duration-150 hover:ring-2 hover:ring-emerald-500 hover:ring-offset-2 ${
          open ? 'ring-2 ring-emerald-500 ring-offset-2' : ''
        }`}
      >
        {user ? initials(user.name) : '관'}
      </button>

      {/* ── Dropdown panel ── */}
      {open ? (
        <div className="absolute right-0 top-14 z-50 w-72 overflow-hidden rounded-2xl border border-slate-100 bg-white p-0 shadow-xl">

          {/* Profile section — gradient top */}
          <div className="bg-gradient-to-br from-emerald-50 to-white px-5 py-5">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold text-white">
                {user ? initials(user.name) : '관'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-900">
                  {user?.name ?? '관리자'}
                </p>
                <p className="truncate text-sm text-slate-500">{user?.role ?? '—'}</p>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {user?.email ?? '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Language section */}
          <div className="px-5 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t('language')}
            </p>
            <div className="flex gap-2">
              {(['ko', 'en'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`flex-1 cursor-pointer rounded-xl py-2 text-sm transition-all duration-150 ${
                    language === lang
                      ? 'bg-emerald-600 font-medium text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {lang === 'ko' ? '한국어' : 'English'}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Settings row */}
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50"
          >
            <Cog6ToothIcon className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-700">{t('settings')}</span>
          </button>

          <div className="border-t border-slate-100" />

          {/* Logout */}
          <div className="px-5 py-4">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-600 transition-all duration-150 hover:bg-red-50"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              {t('logout')}
            </button>
          </div>

        </div>
      ) : null}
    </div>
  )
}

// ── Header ────────────────────────────────────────────────────────────────────

type Props = {
  title: string
  breadcrumbs?: { label: string }[]
  sidebarWidth: number
  onToggleSidebar?: () => void
}

export function Header({ title, breadcrumbs, sidebarWidth, onToggleSidebar }: Props) {
  return (
    <header
      className="fixed top-0 z-30 flex h-[60px] items-center justify-between border-b border-slate-100 bg-white/95 px-4 backdrop-blur-sm transition-[left,width] duration-200 ease-out"
      style={{ left: sidebarWidth, width: `calc(100% - ${sidebarWidth}px)` }}
    >
      {/* Left: hamburger + page title */}
      <div className="flex items-center gap-2.5">
        {onToggleSidebar ? (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="rounded-lg p-2 text-slate-400 transition-all duration-150 hover:bg-slate-100 hover:text-slate-700"
            aria-label="사이드바 토글"
          >
            <Bars3Icon className="h-5 w-5" />
          </button>
        ) : null}
        <div>
          <h1 className="text-[16px] font-bold leading-tight text-slate-900">{title}</h1>
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <p className="text-[11px] text-slate-400">
              {breadcrumbs.map((b, i) => (
                <span key={i}>
                  {i > 0 ? ' · ' : ''}
                  {b.label}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </div>

      {/* Right: date · bell · refresh | avatar */}
      <div className="flex items-center gap-1">
        <time
          className="hidden pr-2 text-[13px] text-slate-400 sm:block"
          dateTime={new Date().toISOString()}
        >
          {formatKoreanLongDate()}
        </time>
        <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />

        <NotificationBell />

        <button
          type="button"
          className="rounded-lg p-2 text-slate-400 transition-all duration-150 hover:bg-slate-100 hover:text-slate-700"
          title="새로고침"
          onClick={() => window.location.reload()}
        >
          <ArrowPathIcon className="h-5 w-5" />
        </button>

        <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden />

        <UserMenu />
      </div>
    </header>
  )
}
