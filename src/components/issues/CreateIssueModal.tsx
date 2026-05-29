import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { ApiError } from '../../api/client'
import { ISSUE_TYPE_META, PRIORITY_META } from '../../lib/issueUi'
import { getWorkers } from '../../services/dailyPlanService'
import { createIssue } from '../../services/issueService'
import type { IssuePriority, IssueType, PinPosition } from '../../types/issue'
import { Button } from '../ui/Button'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { Modal } from '../ui/Modal'

type Props = {
  open: boolean
  courseId: string
  initialPin: PinPosition | null
  onClose: () => void
  onSuccess: (issueId: string) => void
}

const inputClass =
  'h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] outline-none focus:border-[#1B5E20]'
const labelClass = 'mb-1.5 block text-[13px] font-bold text-[#374151]'

const PRIORITIES: IssuePriority[] = ['low', 'medium', 'high', 'critical']
const ISSUE_TYPES = Object.keys(ISSUE_TYPE_META) as IssueType[]
const HOLES = Array.from({ length: 18 }, (_, i) => i + 1)

export function CreateIssueModal({
  open,
  courseId,
  initialPin,
  onClose,
  onSuccess,
}: Props) {
  const [title, setTitle] = useState('')
  const [issueType, setIssueType] = useState<IssueType>('disease')
  const [priority, setPriority] = useState<IssuePriority>('medium')
  const [holeNumber, setHoleNumber] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [workerSearch, setWorkerSearch] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const workersQuery = useQuery({
    queryKey: ['workers', courseId],
    queryFn: () => getWorkers(courseId),
    enabled: open && Boolean(courseId),
  })

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    if (!open) {
      setTitle('')
      setIssueType('disease')
      setPriority('medium')
      setHoleNumber('')
      setAssignedTo('')
      setDescription('')
      setFile(null)
      setWorkerSearch('')
    }
  }, [open])

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!initialPin) throw new ApiError('지도에서 핀 위치를 선택하세요.', 400)
      if (!title.trim()) throw new ApiError('제목을 입력하세요.', 400)

      const formData = new FormData()
      formData.append('course_id', courseId)
      formData.append('title', title.trim())
      formData.append('issue_type', issueType)
      formData.append('priority', priority)
      formData.append('pin_x', String(initialPin.pin_x))
      formData.append('pin_y', String(initialPin.pin_y))
      if (holeNumber) formData.append('hole_number', holeNumber)
      if (assignedTo) formData.append('assigned_to', assignedTo)
      if (description.trim()) formData.append('description', description.trim())
      if (file) formData.append('image', file)

      return createIssue(formData)
    },
    onSuccess: (issue) => {
      toast.success('이슈가 등록되었습니다.', { className: 'gc-toast-success' })
      onSuccess(issue.id)
      onClose()
    },
    onError: (err) => {
      const message =
        err instanceof ApiError ? err.message : '이슈 등록에 실패했습니다.'
      toast.error(message, { className: 'gc-toast-error' })
    },
  })

  const workers = workersQuery.data ?? []
  const filteredWorkers = workers.filter((w) =>
    w.name.toLowerCase().includes(workerSearch.trim().toLowerCase()),
  )

  return (
    <Modal open={open} onClose={onClose} title="이슈 등록" className="max-w-lg">
      {!initialPin ? (
        <p className="text-sm text-[#DC2626]">
          지도에서 위치를 먼저 선택해 주세요.
        </p>
      ) : workersQuery.isLoading ? (
        <LoadingSpinner message="데이터 불러오는 중…" />
      ) : (
        <form
          className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
          onSubmit={(e) => {
            e.preventDefault()
            submitMutation.mutate()
          }}
        >
          <div>
            <label htmlFor="issue-title" className={labelClass}>
              제목 <span className="text-[#EF4444]">*</span>
            </label>
            <input
              id="issue-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div>
            <p className={labelClass}>유형</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ISSUE_TYPES.map((type) => {
                const meta = ISSUE_TYPE_META[type]
                const active = issueType === type
                return (
                  <label
                    key={type}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                      active
                        ? 'border-[#1B5E20] bg-[#F0FDF4] text-[#166534]'
                        : 'border-[#E5E7EB] bg-white text-[#374151]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="issue-type"
                      className="sr-only"
                      checked={active}
                      onChange={() => setIssueType(type)}
                    />
                    <span>{meta.emoji}</span>
                    {meta.label}
                  </label>
                )
              })}
            </div>
          </div>

          <div>
            <p className={labelClass}>우선순위</p>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((p) => {
                const meta = PRIORITY_META[p]
                const active = priority === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                      active
                        ? 'border-[#1B5E20] bg-[#1B5E20] text-white'
                        : `${meta.badgeClass} hover:opacity-90`
                    }`}
                  >
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label htmlFor="issue-hole" className={labelClass}>
              홀 번호
            </label>
            <select
              id="issue-hole"
              value={holeNumber}
              onChange={(e) => setHoleNumber(e.target.value)}
              className={inputClass}
            >
              <option value="">선택 안 함</option>
              {HOLES.map((n) => (
                <option key={n} value={String(n)}>
                  {n}홀
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="issue-worker" className={labelClass}>
              담당자
            </label>
            <input
              id="issue-worker-search"
              type="search"
              value={workerSearch}
              onChange={(e) => setWorkerSearch(e.target.value)}
              placeholder="담당자 검색..."
              className={`${inputClass} mb-2`}
            />
            <select
              id="issue-worker"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className={inputClass}
            >
              <option value="">미지정</option>
              {filteredWorkers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="issue-desc" className={labelClass}>
              설명
            </label>
            <textarea
              id="issue-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full resize-none rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#1B5E20]"
            />
          </div>

          <div>
            <p className={labelClass}>사진</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-lg border border-dashed border-[#E5E7EB] py-3 text-sm text-[#6B7280] hover:border-[#1B5E20]"
            >
              사진 선택 (선택)
            </button>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="미리보기"
                className="mt-2 max-h-32 w-full rounded-lg object-contain"
              />
            ) : null}
          </div>

          <div className="rounded-lg bg-[#F9FAFB] px-3 py-2 text-sm text-[#6B7280]">
            핀 위치: X: {initialPin.pin_x.toFixed(1)}%, Y:{' '}
            {initialPin.pin_y.toFixed(1)}%
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" loading={submitMutation.isPending}>
              이슈 등록
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
