import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  approveAccountRequest,
  fetchPendingAccountRequests,
  rejectAccountRequest,
  type AccountRequest,
} from '../api/accountRequests'
import { fetchSignupCourses, type SignupRole } from '../api/auth'
import { CoursePicker } from '../components/auth/CoursePicker'
import { courseDisplayName } from '../lib/courseName'
import { useLanguageStore } from '../stores/languageStore'

const selectClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'

function formatWhen(iso: string, locale: string) {
  try {
    return new Date(iso).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')
  } catch {
    return iso
  }
}

export function PendingApprovalsPage() {
  const { t, language } = useLanguageStore()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<AccountRequest | null>(null)
  const [modal, setModal] = useState<'approve' | 'reject' | null>(null)
  const [approveRole, setApproveRole] = useState<SignupRole>('course_manager')
  const [approveCourseId, setApproveCourseId] = useState('')

  const pendingQuery = useQuery({
    queryKey: ['account-requests', 'pending'],
    queryFn: fetchPendingAccountRequests,
  })

  const coursesQuery = useQuery({
    queryKey: ['signup-courses'],
    queryFn: fetchSignupCourses,
    enabled: modal === 'approve',
  })

  const approveMutation = useMutation({
    mutationFn: ({
      id,
      role,
      course_id,
    }: {
      id: string
      role?: SignupRole
      course_id?: string
    }) =>
      approveAccountRequest(id, {
        ...(role ? { role } : {}),
        ...(course_id ? { course_id } : {}),
      }),
    onSuccess: () => {
      toast.success(t('approvalsApprovedToast'), { className: 'gc-toast-success' })
      void queryClient.invalidateQueries({ queryKey: ['account-requests', 'pending'] })
      closeModal()
    },
    onError: (err: Error) => {
      toast.error(err.message, { className: 'gc-toast-error' })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectAccountRequest(id),
    onSuccess: () => {
      toast.success(t('approvalsRejectedToast'), { className: 'gc-toast-success' })
      void queryClient.invalidateQueries({ queryKey: ['account-requests', 'pending'] })
      closeModal()
    },
    onError: (err: Error) => {
      toast.error(err.message, { className: 'gc-toast-error' })
    },
  })

  const rows = pendingQuery.data ?? []

  const locale = language === 'ko' ? 'ko-KR' : 'en-US'

  function openApprove(row: AccountRequest) {
    setSelected(row)
    setApproveRole(
      row.role === 'worker' || row.role === 'course_manager'
        ? row.role
        : 'course_manager',
    )
    setApproveCourseId(row.assigned_course_id ?? '')
    setModal('approve')
  }

  function openReject(row: AccountRequest) {
    setSelected(row)
    setModal('reject')
  }

  function closeModal() {
    setModal(null)
    setSelected(null)
  }

  const courseLabel = useMemo(() => {
    if (!selected) return '—'
    if (selected.course_name_ko || selected.course_name) {
      return courseDisplayName(
        {
          name: selected.course_name ?? '',
          name_ko: selected.course_name_ko ?? selected.course_name ?? '',
        },
        language,
      )
    }
    return '—'
  }, [selected, language])

  return (
    <div className="page-enter mx-auto max-w-5xl space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('approvalsTitle')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('approvalsSubtitle')}</p>
      </div>

      {pendingQuery.isLoading ? (
        <p className="text-sm text-slate-500">{t('loading')}</p>
      ) : pendingQuery.isError ? (
        <p className="text-sm text-red-600">{t('approvalsLoadFailed')}</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          {t('approvalsEmpty')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">{t('signupName')}</th>
                <th className="px-4 py-3">{t('signupEmail')}</th>
                <th className="px-4 py-3">{t('signupRole')}</th>
                <th className="px-4 py-3">{t('course')}</th>
                <th className="px-4 py-3">{t('approvalsRequestedAt')}</th>
                <th className="px-4 py-3 text-right">{t('approvalsActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 text-slate-600">{row.email}</td>
                  <td className="px-4 py-3 text-slate-600">{row.role}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.course_name_ko || row.course_name || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatWhen(row.created_at, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openApprove(row)}
                        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
                      >
                        {t('approvalsApprove')}
                      </button>
                      <button
                        type="button"
                        onClick={() => openReject(row)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                      >
                        {t('approvalsReject')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && selected ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            {modal === 'approve' ? (
              <>
                <h2 className="text-lg font-bold text-slate-900">
                  {t('approvalsApproveTitle')}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selected.name} · {selected.email}
                </p>

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
                      {t('signupRole')}
                    </label>
                    <select
                      value={approveRole}
                      onChange={(e) => setApproveRole(e.target.value as SignupRole)}
                      className={selectClass}
                    >
                      <option value="worker">{t('signupRoleWorker')}</option>
                      <option value="course_manager">{t('signupRoleCourseManager')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
                      {t('signupCourse')}
                    </label>
                    <p className="mb-2 text-xs text-slate-500">
                      {t('approvalsRequestedCourse')}: {courseLabel}
                    </p>
                    {coursesQuery.data ? (
                      <CoursePicker
                        courses={coursesQuery.data}
                        value={approveCourseId}
                        onChange={setApproveCourseId}
                      />
                    ) : (
                      <p className="text-sm text-slate-500">{t('loading')}</p>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={!approveCourseId || approveMutation.isPending}
                    onClick={() =>
                      approveMutation.mutate({
                        id: selected.id,
                        role: approveRole,
                        course_id: approveCourseId,
                      })
                    }
                    className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {approveMutation.isPending ? t('processing') : t('approvalsConfirmApprove')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-slate-900">
                  {t('approvalsRejectTitle')}
                </h2>
                <p className="mt-3 text-sm text-slate-600">
                  {t('approvalsRejectConfirm', { name: selected.name })}
                </p>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={rejectMutation.isPending}
                    onClick={() => rejectMutation.mutate(selected.id)}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {rejectMutation.isPending ? t('processing') : t('approvalsConfirmReject')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
