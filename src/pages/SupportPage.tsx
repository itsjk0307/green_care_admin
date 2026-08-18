import { useMemo, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import {
  ChevronDownIcon,
  ClockIcon,
  EnvelopeIcon,
  LifebuoyIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline'
import { API_BASE_URL } from '../config'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { useLanguageStore } from '../stores/languageStore'
import type { TranslationKey } from '../i18n/translations'

const SUPPORT_EMAIL = 'support@daejunggolf.com'

const fieldClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#121820]/40 focus:ring-2 focus:ring-[#121820]/10'

const FAQ_KEYS: { q: TranslationKey; a: TranslationKey }[] = [
  { q: 'supportFaq1Q', a: 'supportFaq1A' },
  { q: 'supportFaq2Q', a: 'supportFaq2A' },
  { q: 'supportFaq3Q', a: 'supportFaq3A' },
  { q: 'supportFaq4Q', a: 'supportFaq4A' },
]

export function SupportPage() {
  const { t } = useLanguageStore()
  const { user } = useAuth()
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mailtoPreview = useMemo(() => {
    const lines = [
      body.trim(),
      '',
      '---',
      `User: ${user?.email || user?.name || '—'}`,
      `Role: ${user?.role || '—'}`,
      `Page: ${typeof window !== 'undefined' ? window.location.href : '—'}`,
      `API: ${API_BASE_URL}`,
    ]
    return lines.join('\n')
  }, [body, user])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!subject.trim()) next.subject = t('supportReportNeedSubject')
    if (!body.trim()) next.body = t('supportReportNeedBody')
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      `[GreenCare Admin] ${subject.trim()}`,
    )}&body=${encodeURIComponent(mailtoPreview)}`

    try {
      window.location.href = href
      toast.success(t('supportReportOpened'), { className: 'gc-toast-success' })
    } catch {
      toast.error(t('supportReportBlocked'), { className: 'gc-toast-error' })
    }
  }

  return (
    <div className="page-enter mx-auto max-w-5xl space-y-5 pb-20 sm:space-y-6">
      <div>
        <div className="flex items-center gap-2 text-[#121820]">
          <LifebuoyIcon className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            {t('support')}
          </span>
        </div>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          {t('supportTitle')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          {t('supportSubtitle')}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            {t('supportContactTitle')}
          </h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <ClockIcon className="h-4 w-4" />
              </span>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t('supportContactHours')}
                </dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {t('supportContactHoursValue')}
                </dd>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <EnvelopeIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t('supportContactEmail')}
                </dt>
                <dd className="mt-0.5">
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="font-semibold text-slate-900 underline-offset-2 hover:underline"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                </dd>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <PhoneIcon className="h-4 w-4" />
              </span>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t('supportContactPhone')}
                </dt>
                <dd className="mt-0.5 font-medium text-slate-900">—</dd>
              </div>
            </div>
          </dl>
          <p className="mt-5 text-sm text-slate-500">{t('supportContactNote')}</p>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-3">
          <h2 className="text-base font-bold text-slate-900">
            {t('supportReportTitle')}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {t('supportReportSubtitle')}
          </p>
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div>
              <label
                className="mb-1.5 block text-sm font-semibold text-slate-800"
                htmlFor="sup-subject"
              >
                {t('supportReportSubject')}
              </label>
              <input
                id="sup-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t('supportReportSubjectPh')}
                className={fieldClass}
              />
              {errors.subject ? (
                <p className="mt-1 text-xs text-red-600">{errors.subject}</p>
              ) : null}
            </div>
            <div>
              <label
                className="mb-1.5 block text-sm font-semibold text-slate-800"
                htmlFor="sup-body"
              >
                {t('supportReportBody')}
              </label>
              <textarea
                id="sup-body"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t('supportReportBodyPh')}
                className={fieldClass}
              />
              {errors.body ? (
                <p className="mt-1 text-xs text-red-600">{errors.body}</p>
              ) : null}
            </div>
            <Button
              type="submit"
              className="w-full !bg-[#121820] text-white shadow-sm hover:!bg-[#1c2630] active:!bg-[#0d1218] sm:w-auto"
            >
              {t('supportReportSend')}
            </Button>
          </form>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          {t('supportFaqTitle')}
        </h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {FAQ_KEYS.map((item, index) => {
            const open = openFaq === index
            return (
              <li key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(open ? null : index)}
                  className="flex w-full items-center justify-between gap-3 py-3.5 text-left"
                >
                  <span className="text-sm font-semibold text-slate-800">
                    {t(item.q)}
                  </span>
                  <ChevronDownIcon
                    className={`h-4 w-4 shrink-0 text-slate-400 transition ${
                      open ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {open ? (
                  <p className="pb-3.5 text-sm leading-relaxed text-slate-600">
                    {t(item.a)}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
