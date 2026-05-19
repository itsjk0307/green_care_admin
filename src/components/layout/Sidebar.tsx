import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRightOnRectangleIcon,
  BeakerIcon,
  ClipboardDocumentListIcon,
  ClipboardDocumentCheckIcon,
  HomeIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '../../context/AuthContext'
import { initials } from '../../lib/formatKoreanDate'

const nav = [
  { to: '/', label: '대시보드', icon: HomeIcon },
  { to: '/work-reports', label: '작업 보고서', icon: ClipboardDocumentListIcon },
  { to: '/daily-plan', label: '일일 작업 계획', icon: ClipboardDocumentCheckIcon },
  { to: '/disease-reports', label: '질병 분석', icon: BeakerIcon },
]

type Props = {
  collapsed: boolean
}

function pathActive(pathname: string, to: string) {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function Sidebar({ collapsed }: Props) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const w = collapsed ? 'w-[72px]' : 'w-64'

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[#EEEEEE] bg-white ${w} transition-[width] duration-150 ease-out`}
    >
      <div
        className={`border-b border-[#F3F4F6] px-5 pb-5 ${collapsed ? 'px-3 pt-5' : 'pt-6'}`}
      >
        <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
          <span className="text-2xl leading-none text-[#1B5E20]" aria-hidden>
            ⛳
          </span>
          {!collapsed ? (
            <>
              <span className="text-lg font-bold text-[#111827]">GreenCare</span>
              <span className="rounded-full bg-[#F0FDF4] px-2 py-0.5 text-[10px] font-bold text-[#166534]">
                관리자
              </span>
            </>
          ) : null}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p
          className={`px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[1.5px] text-[#9CA3AF] ${collapsed ? 'text-center' : ''}`}
        >
          {collapsed ? '·' : '메뉴'}
        </p>
        <ul className="space-y-0.5">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = pathActive(pathname, to)
            return (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  title={label}
                  className={({ isActive }) =>
                    `flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150 ${
                      isActive
                        ? 'bg-[#F0FDF4] font-semibold text-[#1B5E20]'
                        : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#374151]'
                    } ${collapsed ? 'justify-center px-0' : ''}`
                  }
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 ${
                      active ? 'text-[#1B5E20]' : 'text-[#9CA3AF]'
                    }`}
                  />
                  {!collapsed ? <span className="truncate">{label}</span> : null}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-[#F3F4F6] px-3 py-4">
        <div
          className={`flex items-center gap-3 ${collapsed ? 'flex-col' : ''}`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1B5E20] text-xs font-bold text-white">
            {user ? initials(user.name) : '—'}
          </div>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-[#111827]">
                {user?.name ?? '게스트'}
              </p>
              <p className="truncate text-[11px] text-[#6B7280]">
                {user?.role ?? '—'}
              </p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => {
              logout()
              navigate('/login', { replace: true })
            }}
            className="ml-auto rounded-lg p-2 text-[#9CA3AF] transition hover:bg-[#F3F4F6] hover:text-[#374151]"
            title="로그아웃"
            aria-label="로그아웃"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
