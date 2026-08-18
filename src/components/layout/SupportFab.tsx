import { Link, useLocation } from 'react-router-dom'
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline'
import { useLanguageStore } from '../../stores/languageStore'

/** Routes where a fixed bottom-right FAB would cover primary controls. */
function shouldHideSupportFab(pathname: string): boolean {
  if (pathname.startsWith('/support')) return true
  if (pathname === '/ai' || pathname.startsWith('/ai/')) return true
  if (pathname === '/course-map' || pathname.startsWith('/course-map/')) {
    return true
  }
  return false
}

/** Floating Support entry — bottom-right of the app shell (GreenCare Hub pattern). */
export function SupportFab() {
  const { t } = useLanguageStore()
  const { pathname } = useLocation()

  if (shouldHideSupportFab(pathname)) return null

  return (
    <Link
      to="/support"
      className="fixed bottom-5 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-[#121820] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(18,24,32,0.28)] transition hover:bg-[#1c2630] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#121820]/25 sm:bottom-6 sm:right-6"
      aria-label={t('support')}
    >
      <QuestionMarkCircleIcon className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">{t('support')}</span>
    </Link>
  )
}
