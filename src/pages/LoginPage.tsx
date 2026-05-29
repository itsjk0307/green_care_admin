import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../config'
import { devCheckApiHealth, devTerminalLog } from '../lib/devLog'

const FEATURES = [
  '실시간 현장 작업 모니터링',
  '드론 스캔 및 AI 질병 분석',
  '이슈 추적 및 보고서 관리',
  '작업 일지 및 포토박스',
]

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    devTerminalLog('info', 'Login page loaded', { apiBase: API_BASE_URL })
    void devCheckApiHealth(API_BASE_URL)
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('이메일과 비밀번호를 입력하세요.')
      return
    }
    setLoading(true)
    try {
      await login(email.trim(), password)
      toast.success('로그인되었습니다.', { className: 'gc-toast-success' })
      navigate('/', { replace: true })
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : '로그인에 실패했습니다. 다시 시도해 주세요.'
      setError(message)
      toast.error(message, { className: 'gc-toast-error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Left branding panel ── */}
      <div className="relative hidden lg:flex lg:w-[460px] xl:w-[520px] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#052e16] via-[#166534] to-[#15803d] p-12">
        {/* Subtle background circles */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-white/5" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-[20px] backdrop-blur-sm">
            ⛳
          </div>
          <div>
            <p className="text-[18px] font-bold tracking-tight text-white">GreenCare</p>
            <p className="text-[11px] font-medium text-emerald-300">대중골프엔지니어링</p>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative">
          <h2 className="text-[40px] font-bold leading-[1.18] tracking-tight text-white">
            스마트 골프장<br />관리 시스템
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-emerald-200">
            현장과 데이터를 한곳에서.<br />더 빠르고 정확한 관리를 시작하세요.
          </p>

          <ul className="mt-8 space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3">
                <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-400" />
                <span className="text-[14px] text-emerald-100">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="relative text-[12px] text-emerald-600">
          © {new Date().getFullYear()} GreenCare · 대중골프엔지니어링
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-[400px]">
          {/* Mobile-only logo */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="text-2xl" aria-hidden>⛳</span>
            <span className="text-xl font-bold text-slate-900">GreenCare</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-7">
              <h1 className="text-[24px] font-bold text-slate-900">다시 오신 것을 환영합니다</h1>
              <p className="mt-1.5 text-sm text-slate-500">관리자 계정으로 로그인하세요</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  이메일
                </label>
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="admin@greencare.com"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  비밀번호
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="••••••••"
                />
              </div>

              {error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
                >
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    처리 중…
                  </>
                ) : (
                  '로그인'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
