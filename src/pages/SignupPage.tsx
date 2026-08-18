import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { CoursePicker } from '../components/auth/CoursePicker'
import {
  fetchSignupCourses,
  signupRequest,
  type SignupRole,
} from '../api/auth'
import { useLanguageStore } from '../stores/languageStore'

const inputClass =
  'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20'

export function SignupPage() {
  const navigate = useNavigate()
  const { t } = useLanguageStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<SignupRole>('course_manager')
  const [courseId, setCourseId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const coursesQuery = useQuery({
    queryKey: ['signup-courses'],
    queryFn: fetchSignupCourses,
  })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim() || !email.trim() || !password || !courseId) {
      setError(t('signupRequiredFields'))
      return
    }
    setLoading(true)
    try {
      await signupRequest({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        course_id: courseId,
      })
      navigate('/signup/pending', { replace: true, state: { email: email.trim() } })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('signupFailed')
      setError(message)
      toast.error(message, { className: 'gc-toast-error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2.5">
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg object-cover" />
          <span className="text-xl font-bold text-slate-900">GreenCare</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">{t('signupTitle')}</h1>
          <p className="mt-1.5 text-sm text-slate-500">{t('signupSubtitle')}</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {t('signupName')}
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                autoComplete="name"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {t('signupEmail')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {t('signupPassword')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {t('signupRole')}
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as SignupRole)}
                className={inputClass}
              >
                <option value="worker">{t('signupRoleWorker')}</option>
                <option value="course_manager">{t('signupRoleCourseManager')}</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {t('signupCourse')}
              </label>
              {coursesQuery.isLoading ? (
                <p className="text-sm text-slate-500">{t('loading')}</p>
              ) : coursesQuery.isError ? (
                <p className="text-sm text-red-600">{t('signupCoursesLoadFailed')}</p>
              ) : (
                <CoursePicker
                  courses={coursesQuery.data ?? []}
                  value={courseId}
                  onChange={setCourseId}
                />
              )}
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
              disabled={loading || coursesQuery.isLoading}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-brand text-sm font-semibold text-white transition hover:bg-brand-light disabled:opacity-60"
            >
              {loading ? t('processing') : t('signupSubmit')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {t('signupHaveAccount')}{' '}
            <Link to="/login" className="font-semibold text-brand hover:underline">
              {t('signupBackToLogin')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
