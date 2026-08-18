import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRightOnRectangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { initials } from '../../lib/formatKoreanDate'
import { useAuth } from '../../context/AuthContext'
import { useLanguageStore } from '../../stores/languageStore'
import { Button } from '../ui/Button'

type Props = {
  open: boolean
  onClose: () => void
}

export function SettingsPanel({ open, onClose }: Props) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { t, language, setLanguage } = useLanguageStore()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function handleLogout() {
    logout()
    onClose()
    navigate('/login', { replace: true })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px] transition-opacity"
        aria-label="Close"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('settings')}
        className="relative flex h-full w-full max-w-full flex-col bg-white shadow-[var(--shadow-gc-modal)] sm:max-w-[400px]"
      >
        <div className="flex items-center justify-between border-b border-[#eef2ef] px-5 py-4">
          <div>
            <h2 className="text-[16px] font-semibold tracking-tight text-slate-900">
              {t('settings')}
            </h2>
            <p className="mt-0.5 text-[12px] text-slate-400">
              {t('settingsSubtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-[#f0f4f1] hover:text-slate-700"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="bg-[linear-gradient(135deg,#f1f3f5_0%,#ffffff_55%)] px-5 py-7">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#121820] to-[#2a3441] text-xl font-bold text-white shadow-[0_8px_20px_rgba(18,24,32,0.28)]">
                {user ? initials(user.name) : '관'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[17px] font-semibold tracking-tight text-slate-900">
                  {user?.name ?? t('adminFallback')}
                </p>
                <p className="mt-0.5 truncate text-[13px] capitalize text-slate-500">
                  {user?.role ?? '—'}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-slate-400">
                  {user?.email ?? '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-[#eef2ef] px-5 py-5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {t('language')}
            </p>
            <p className="mb-3 text-[12px] text-slate-500">{t('languageHint')}</p>
            <div className="grid grid-cols-2 gap-2">
              {(['ko', 'en'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`rounded-xl py-2.5 text-[13px] transition-all duration-150 ${
                    language === lang
                      ? 'bg-[#121820] font-semibold text-white shadow-[0_4px_12px_rgba(18,24,32,0.25)]'
                      : 'bg-[#f4f5f7] font-medium text-slate-600 hover:bg-[#e8eaed]'
                  }`}
                >
                  {lang === 'ko' ? '한국어' : 'English'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-[#eef2ef] px-5 py-5">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {t('account')}
          </p>
          <Button
            variant="danger"
            className="w-full"
            icon={<ArrowRightOnRectangleIcon className="h-4 w-4" />}
            onClick={handleLogout}
          >
            {t('logout')}
          </Button>
        </div>
      </aside>
    </div>
  )
}
