import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { formatKoreanLongDate, initials } from '../../lib/formatKoreanDate'
import { useAuth } from '../../context/AuthContext'

type Props = {
  title: string
  breadcrumbs?: { label: string }[]
  sidebarWidth: number
}

export function Header({ title, breadcrumbs, sidebarWidth }: Props) {
  const { user } = useAuth()

  return (
    <header
      className="fixed top-0 z-30 flex h-[60px] items-center justify-between border-b border-[#EEEEEE] bg-white px-6"
      style={{ left: sidebarWidth, width: `calc(100% - ${sidebarWidth}px)` }}
    >
      <div>
        <h1 className="text-xl font-bold text-[#111827]">{title}</h1>
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <p className="mt-0.5 text-xs text-[#9CA3AF]">
            {breadcrumbs.map((b, i) => (
              <span key={i}>
                {i > 0 ? ' · ' : ''}
                {b.label}
              </span>
            ))}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <time className="text-[13px] text-[#6B7280]" dateTime={new Date().toISOString()}>
          {formatKoreanLongDate()}
        </time>
        <span className="h-4 w-px bg-[#E5E7EB]" aria-hidden />
        <button
          type="button"
          className="rounded-lg p-2 text-[#6B7280] transition hover:bg-[#F3F4F6]"
          title="새로고침"
          onClick={() => window.location.reload()}
        >
          <ArrowPathIcon className="h-5 w-5" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1B5E20] text-xs font-bold text-white">
          {user ? initials(user.name) : '관'}
        </div>
      </div>
    </header>
  )
}
