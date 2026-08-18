import { ClockIcon } from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'
import { useLanguageStore } from '../stores/languageStore'

export function SignupPendingPage() {
  const { t } = useLanguageStore()

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50">
          <ClockIcon className="h-7 w-7 text-amber-600" />
        </div>
        <h1 className="mt-5 text-xl font-bold text-slate-900">{t('signupPendingTitle')}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {t('signupPendingMessage')}
        </p>
        <Link
          to="/login"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-brand px-6 text-sm font-semibold text-white transition hover:bg-brand-light"
        >
          {t('signupBackToLogin')}
        </Link>
      </div>
    </div>
  )
}
