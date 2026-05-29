import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../../context/AuthContext'
import { ApiError } from '../../api/client'
import {
  ISSUE_TYPE_META,
  PRIORITY_META,
  STATUS_META,
  formatIssueDateTime,
  nextStatus,
} from '../../lib/issueUi'
import { getWorkers } from '../../services/dailyPlanService'
import {
  deleteIssue,
  getIssueDetail,
  resolveStorageUrl,
  updateIssue,
} from '../../services/issueService'
import type { IssueStatus } from '../../types/issue'
import { Button } from '../ui/Button'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { PhotoViewerModal } from '../PhotoViewerModal'

type Props = {
  issueId: string
  courseId: string
  onClose: () => void
  onUpdate: () => void
  onDelete: () => void
}

const STATUSES: IssueStatus[] = ['open', 'in_progress', 'resolved']

export function IssueDetailSidebar({
  issueId,
  courseId,
  onClose,
  onUpdate,
  onDelete,
}: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [editingDesc, setEditingDesc] = useState(false)
  const [descDraft, setDescDraft] = useState('')
  const [photoOpen, setPhotoOpen] = useState(false)

  const detailQuery = useQuery({
    queryKey: ['issue', issueId],
    queryFn: () => getIssueDetail(issueId),
  })

  const workersQuery = useQuery({
    queryKey: ['workers', courseId],
    queryFn: () => getWorkers(courseId),
    enabled: Boolean(courseId),
  })

  const issue = detailQuery.data

  useEffect(() => {
    if (issue) setDescDraft(issue.description ?? '')
  }, [issue])

  const patchMutation = useMutation({
    mutationFn: (body: Parameters<typeof updateIssue>[1]) =>
      updateIssue(issueId, body),
    onSuccess: () => {
      toast.success('저장되었습니다.', { className: 'gc-toast-success' })
      void queryClient.invalidateQueries({ queryKey: ['issue', issueId] })
      void queryClient.invalidateQueries({ queryKey: ['issues'] })
      onUpdate()
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : '저장에 실패했습니다.',
        { className: 'gc-toast-error' },
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteIssue(issueId),
    onSuccess: () => {
      toast.success('이슈가 삭제되었습니다.', { className: 'gc-toast-success' })
      onDelete()
      onClose()
    },
    onError: (err) => {
      toast.error(
        err instanceof ApiError ? err.message : '삭제에 실패했습니다.',
        { className: 'gc-toast-error' },
      )
    },
  })

  const canDelete =
    user?.role === 'admin' ||
    (issue?.reporter_id && user?.id === issue.reporter_id)

  const imageUrl = resolveStorageUrl(issue?.image_path)

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/30"
        aria-label="닫기"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-[400px] max-w-full flex-col bg-white shadow-xl">
        {detailQuery.isLoading ? (
          <LoadingSpinner message="이슈 불러오는 중…" />
        ) : detailQuery.isError || !issue ? (
          <p className="p-6 text-sm text-[#DC2626]">
            이슈를 불러오지 못했습니다.
          </p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-[#F3F4F6] p-5">
              <h2 className="flex-1 text-lg font-bold text-[#111827]">
                {issue.title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-[#9CA3AF] hover:bg-[#F3F4F6]"
                aria-label="닫기"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {canDelete ? (
                <Button
                  variant="danger"
                  size="sm"
                  className="mb-4"
                  loading={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm('이 이슈를 삭제하시겠습니까?')) {
                      deleteMutation.mutate()
                    }
                  }}
                >
                  삭제
                </Button>
              ) : null}

              <div className="mb-4 flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ISSUE_TYPE_META[issue.issue_type].badgeClass}`}
                >
                  {ISSUE_TYPE_META[issue.issue_type].emoji}{' '}
                  {ISSUE_TYPE_META[issue.issue_type].label}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${PRIORITY_META[issue.priority].badgeClass}`}
                >
                  {PRIORITY_META[issue.priority].label}
                </span>
              </div>

              <p className="mb-2 text-xs font-bold text-[#6B7280]">상태</p>
              <div className="mb-5 flex items-center gap-1">
                {STATUSES.map((status, index) => {
                  const active = issue.status === status
                  const passed =
                    STATUSES.indexOf(issue.status) >= index
                  return (
                    <div key={status} className="flex flex-1 items-center">
                      <button
                        type="button"
                        disabled={patchMutation.isPending}
                        onClick={() => patchMutation.mutate({ status })}
                        className={`w-full rounded-lg border py-2 text-center text-xs font-semibold transition ${
                          active
                            ? 'border-[#1B5E20] bg-[#1B5E20] text-white'
                            : passed
                              ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534] hover:bg-[#DCFCE7]'
                              : 'border-[#E5E7EB] bg-white text-[#9CA3AF] hover:border-[#BBF7D0]'
                        }`}
                      >
                        {STATUS_META[status].label}
                      </button>
                      {index < STATUSES.length - 1 ? (
                        <span className="mx-0.5 text-[#D1D5DB]">→</span>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              <div className="mb-5">
                <label
                  htmlFor="issue-assignee"
                  className="mb-1.5 block text-xs font-bold text-[#6B7280]"
                >
                  담당자
                </label>
                <select
                  id="issue-assignee"
                  value={issue.assigned_to ?? ''}
                  disabled={patchMutation.isPending}
                  onChange={(e) =>
                    patchMutation.mutate({
                      assigned_to: e.target.value || null,
                    })
                  }
                  className="h-10 w-full rounded-lg border border-[#E5E7EB] px-3 text-sm outline-none focus:border-[#1B5E20]"
                >
                  <option value="">미지정</option>
                  {(workersQuery.data ?? []).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                {issue.assigned_to_name ? (
                  <p className="mt-1 text-xs text-[#6B7280]">
                    현재: {issue.assigned_to_name}
                  </p>
                ) : null}
              </div>

              <div className="mb-5">
                <p className="mb-1.5 text-xs font-bold text-[#6B7280]">설명</p>
                {editingDesc ? (
                  <div className="space-y-2">
                    <textarea
                      value={descDraft}
                      onChange={(e) => setDescDraft(e.target.value)}
                      rows={4}
                      className="w-full resize-none rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B5E20]"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingDesc(false)
                          setDescDraft(issue.description ?? '')
                        }}
                      >
                        취소
                      </Button>
                      <Button
                        size="sm"
                        loading={patchMutation.isPending}
                        onClick={() => {
                          patchMutation.mutate(
                            { description: descDraft.trim() || null },
                            {
                              onSuccess: () => setEditingDesc(false),
                            },
                          )
                        }}
                      >
                        저장
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingDesc(true)}
                    className="w-full rounded-lg border border-[#EEEEEE] bg-[#F9FAFB] px-3 py-2.5 text-left text-sm text-[#374151] hover:border-[#1B5E20]"
                  >
                    {issue.description?.trim() || '설명을 입력하려면 클릭하세요'}
                  </button>
                )}
              </div>

              {imageUrl ? (
                <button
                  type="button"
                  onClick={() => setPhotoOpen(true)}
                  className="mb-5 block w-full overflow-hidden rounded-xl border border-[#EEEEEE]"
                >
                  <img
                    src={imageUrl}
                    alt="이슈 사진"
                    className="h-auto w-full object-cover"
                  />
                </button>
              ) : null}

              <div className="space-y-2 rounded-xl bg-[#F9FAFB] px-4 py-3 text-sm text-[#374151]">
                <p>
                  📍{' '}
                  {issue.hole_number != null
                    ? `홀 ${issue.hole_number}`
                    : '홀 미지정'}{' '}
                  | Pin: ({issue.pin_x.toFixed(1)}%, {issue.pin_y.toFixed(1)}%)
                </p>
                <p>👤 신고자: {issue.reporter_name ?? '—'}</p>
                <p>🕐 {formatIssueDateTime(issue.created_at)}</p>
              </div>
            </div>

            <div className="border-t border-[#F3F4F6] p-4">
              <Button
                className="w-full"
                loading={patchMutation.isPending}
                disabled={issue.status === 'resolved'}
                onClick={() =>
                  patchMutation.mutate({ status: nextStatus(issue.status) })
                }
              >
                상태 업데이트
              </Button>
            </div>
          </>
        )}
      </aside>

      {imageUrl && photoOpen ? (
        <PhotoViewerModal
          open
          images={[imageUrl]}
          index={0}
          caption={issue?.title ?? ''}
          onClose={() => setPhotoOpen(false)}
          onIndexChange={() => {}}
        />
      ) : null}
    </>
  )
}
