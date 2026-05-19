import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
    } catch {
      setError('로그인에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-center bg-[#1B5E20] px-12 text-white lg:flex">
        <p className="text-3xl font-bold leading-tight tracking-tight">
          스마트 골프장 관리의 시작
        </p>
        <p className="mt-3 text-lg text-white/90">
          현장과 데이터를 한곳에서 관리하세요
        </p>
        <div className="mt-12 flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            ⛳
          </span>
          <div>
            <p className="text-xl font-bold">GreenCare</p>
            <p className="mt-1 text-sm text-white/75">
              대중골프엔지니어링
            </p>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-1 items-center justify-center bg-white px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-[360px]">
          <h1 className="text-2xl font-bold text-[#111827]">
            다시 오신 것을 환영합니다 👋
          </h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            관리자 계정으로 로그인하세요
          </p>

          <form className="mt-8" onSubmit={onSubmit}>
            <label className="mb-1.5 block text-[13px] font-bold text-[#374151]">
              이메일
            </label>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 h-11 w-full rounded-[10px] border-[1.5px] border-[#E5E7EB] px-3.5 text-sm text-[#111827] outline-none transition focus:border-[#1B5E20] focus:shadow-[0_0_0_3px_rgba(27,94,32,0.1)]"
              placeholder="admin@greencare.com"
            />

            <label className="mb-1.5 block text-[13px] font-bold text-[#374151]">
              비밀번호
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-[10px] border-[1.5px] border-[#E5E7EB] px-3.5 text-sm text-[#111827] outline-none transition focus:border-[#1B5E20] focus:shadow-[0_0_0_3px_rgba(27,94,32,0.1)]"
              placeholder="••••••••"
            />

            <button
              type="submit"
              disabled={loading}
              className="mt-6 h-11 w-full rounded-[10px] bg-[#1B5E20] text-sm font-semibold text-white transition hover:bg-[#166534] active:bg-[#14532D] disabled:opacity-60"
            >
              {loading ? '처리 중…' : '로그인'}
            </button>

            {error ? (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-[13px] text-[#DC2626]"
              >
                {error}
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  )
}
