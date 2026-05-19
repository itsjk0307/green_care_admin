import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { PhotoViewerModal } from '../components/PhotoViewerModal'
import {
  mockWorkReports,
  type MockWorkReport,
  type WorkStatus,
} from '../data/mockData'
import { initials } from '../lib/formatKoreanDate'

const courseOptions = [
  { value: '', label: '전체 코스' },
  { value: '솔트베이 골프클럽', label: '솔트베이 골프클럽' },
  { value: '오크밸리 골프클럽', label: '오크밸리 골프클럽' },
  { value: '남서울 골프클럽', label: '남서울 골프클럽' },
]
const statuses: { v: string; label: string }[] = [
  { v: '', label: '전체 상태' },
  { v: 'pending', label: '대기중' },
  { v: 'approved', label: '승인됨' },
  { v: 'rejected', label: '반려됨' },
]

function statusBadge(s: WorkStatus) {
  if (s === 'pending') return <Badge variant="pending">대기중</Badge>
  if (s === 'approved') return <Badge variant="approved">승인됨</Badge>
  return <Badge variant="rejected">반려됨</Badge>
}

export function WorkReportsPage() {
  const [list, setList] = useState<MockWorkReport[]>(mockWorkReports)
  const [course, setCourse] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [viewer, setViewer] = useState<{
    urls: string[]
    i: number
    cap: string
  } | null>(null)

  const filtered = useMemo(() => {
    return list.filter((r) => {
      if (course && r.course !== course) return false
      if (status && r.status !== status) return false
      if (search && !r.workerName.includes(search)) return false
      return true
    })
  }, [list, course, status, search])

  function approve(id: string) {
    setList((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, status: 'approved' as const, reviewer: '관리자' }
          : r,
      ),
    )
    toast.success('승인 처리되었습니다.', { className: 'gc-toast-success' })
  }

  function reject(id: string) {
    setList((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'rejected' as const } : r)),
    )
    toast('반려 처리되었습니다.', { className: 'gc-toast-info' })
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">작업 보고서</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          현장 작업 기록을 검토하고 승인하세요
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#EEEEEE] bg-white px-5 py-4 shadow-[var(--shadow-gc-card)]">
        <select
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          className="h-9 min-w-[140px] rounded-lg border border-[#E5E7EB] bg-white px-2 text-[13px] text-[#111827] outline-none focus:border-[#1B5E20]"
        >
          {courseOptions.map((c) => (
            <option key={c.value || 'all'} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 w-[120px] rounded-lg border border-[#E5E7EB] bg-white px-2 text-[13px] outline-none focus:border-[#1B5E20]"
        >
          {statuses.map((s) => (
            <option key={s.v || 'all'} value={s.v}>
              {s.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="h-9 w-[140px] rounded-lg border border-[#E5E7EB] px-2 text-[13px]"
        />
        <input
          type="date"
          className="h-9 w-[140px] rounded-lg border border-[#E5E7EB] px-2 text-[13px]"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="작업자 이름"
          className="h-9 w-[200px] rounded-lg border border-[#E5E7EB] px-2 text-[13px] outline-none focus:border-[#1B5E20]"
        />
        <Button size="sm" className="!h-9">
          검색
        </Button>
      </div>

      <div className="space-y-3">
        {filtered.map((r) => (
          <article
            key={r.id}
            className="rounded-2xl border border-[#EEEEEE] bg-white p-5 shadow-[var(--shadow-gc-card)] transition-all duration-150 hover:-translate-y-px hover:shadow-[var(--shadow-gc-elevated)] md:px-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#F3F4F6] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1B5E20] text-sm font-bold text-white">
                  {initials(r.workerName)}
                </div>
                <div>
                  <p className="text-[15px] font-bold text-[#111827]">
                    {r.workerName}{' '}
                    <Badge variant="info" className="ml-1 align-middle">
                      {r.workerRole}
                    </Badge>
                  </p>
                  <p className="mt-0.5 text-[13px] text-[#6B7280]">{r.course}</p>
                </div>
              </div>
              <div className="text-right">
                {statusBadge(r.status)}
                <p className="mt-1 text-[13px] text-[#9CA3AF]">{r.date}</p>
                <p className="text-[11px] text-[#9CA3AF]">{r.timeAgo}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {r.workTypes.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-1 text-xs font-medium text-[#166534]"
                >
                  {t}
                </span>
              ))}
            </div>

            <p className="mb-2 mt-5 text-xs font-medium text-[#6B7280]">
              작업 사진
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                className="text-left transition hover:scale-[1.02]"
                onClick={() =>
                  setViewer({
                    urls: [r.beforeUrl, r.afterUrl],
                    i: 0,
                    cap: '작업 전',
                  })
                }
              >
                <img
                  src={r.beforeUrl}
                  alt=""
                  className="h-[120px] w-[160px] rounded-[10px] border border-[#EEEEEE] object-cover"
                />
                <span className="mt-1 block text-xs text-[#6B7280]">작업 전</span>
              </button>
              <button
                type="button"
                className="text-left transition hover:scale-[1.02]"
                onClick={() =>
                  setViewer({
                    urls: [r.beforeUrl, r.afterUrl],
                    i: 1,
                    cap: '작업 후',
                  })
                }
              >
                <img
                  src={r.afterUrl}
                  alt=""
                  className="h-[120px] w-[160px] rounded-[10px] border border-[#EEEEEE] object-cover"
                />
                <span className="mt-1 block text-xs text-[#6B7280]">작업 후</span>
              </button>
            </div>

            {r.notes ? (
              <div className="mt-4">
                <p className="mb-1 text-xs text-[#9CA3AF]">메모</p>
                <div className="rounded-lg bg-[#F9FAFB] px-3.5 py-2.5 text-[13px] text-[#6B7280]">
                  {r.notes}
                </div>
              </div>
            ) : null}

            {r.status === 'pending' ? (
              <div className="mt-4 flex gap-2 border-t border-[#F3F4F6] pt-4">
                <Button size="sm" onClick={() => approve(r.id)}>
                  승인
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => reject(r.id)}
                >
                  반려
                </Button>
              </div>
            ) : r.status === 'approved' ? (
              <div className="mt-4 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-2.5 text-sm font-medium text-[#166534]">
                승인됨 · 승인자: {r.reviewer ?? '관리자'} · {r.date}
              </div>
            ) : (
              <div className="mt-4 rounded-lg bg-[#FEF2F2] px-4 py-2.5 text-sm font-medium text-[#DC2626]">
                반려됨 · {r.date}
              </div>
            )}
          </article>
        ))}
      </div>

      {viewer ? (
        <PhotoViewerModal
          open
          images={viewer.urls}
          index={viewer.i}
          caption={viewer.cap}
          onClose={() => setViewer(null)}
          onIndexChange={(i) => setViewer((v) => (v ? { ...v, i } : v))}
        />
      ) : null}
    </div>
  )
}
