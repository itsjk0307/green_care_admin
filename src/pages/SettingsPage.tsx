import { useNavigate } from 'react-router-dom'
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { initials } from '../lib/formatKoreanDate'
import { useAuth } from '../context/AuthContext'
import { useLanguageStore } from '../stores/languageStore'
import { Button } from '../components/ui/Button'

export function SettingsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { t, language, setLanguage } = useLanguageStore()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="page-enter mx-auto max-w-xl space-y-4 pb-8 sm:space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          {t('settings')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t('settingsSubtitle')}</p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
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
      </section>
    </div>
  )
}
