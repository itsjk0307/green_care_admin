import { ShieldExclamationIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'
import { useLanguageStore } from '../stores/languageStore'

type Props = {
  /** When set, show this role in the notice (e.g. rejected login attempt). */
  attemptedRole?: string
}

/**
 * Shown when a non-admin/manager account reaches the admin web app.
 * Workers should use the mobile app instead.
 */
export function StaffOnlyPage({ attemptedRole }: Props) {
  const { logout } = useAuth()
  const { t } = useLanguageStore()

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50">
          <ShieldExclamationIcon className="h-7 w-7 text-amber-600" />
        </div>
        <h1 className="mt-5 text-center text-xl font-bold text-slate-900">
          {t('staffOnlyTitle')}
        </h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-slate-600">
          {t('staffOnlyMessage')}
        </p>
        {attemptedRole ? (
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
            role: <span className="font-semibold text-slate-700">{attemptedRole}</span>
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            logout()
            window.location.assign('/login')
          }}
          className="mt-6 flex h-11 w-full items-center justify-center rounded-xl bg-brand text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          {t('staffOnlyBackToLogin')}
        </button>
      </div>
    </div>
  )
}
