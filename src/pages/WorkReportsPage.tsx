import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
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

const selectClass =
  'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-all duration-150 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer'

const inputClass =
  'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'

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
      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
        <select
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          className={`${selectClass} min-w-[160px]`}
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
          className={`${selectClass} w-[130px]`}
        >
          {statuses.map((s) => (
            <option key={s.v || 'all'} value={s.v}>
              {s.label}
            </option>
          ))}
        </select>

        <input
          type="date"
          className={`${inputClass} w-[145px]`}
        />
        <input
          type="date"
          className={`${inputClass} w-[145px]`}
        />

        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="작업자 이름"
            className={`${inputClass} w-[180px] pl-9`}
          />
        </div>

        <Button size="sm">검색</Button>

        <span className="ml-auto text-sm text-slate-400">
          총 <span className="font-semibold text-slate-700">{filtered.length}</span>건
        </span>
      </div>

      {/* ── Report cards ── */}
      <div className="space-y-4">
        {filtered.map((r) => (
          <article
            key={r.id}
            className="rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            {/* Card header */}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                  {initials(r.workerName)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[15px] font-bold text-slate-900">{r.workerName}</p>
                    <Badge variant="info">{r.workerRole}</Badge>
                  </div>
                  <p className="mt-0.5 text-[13px] text-slate-400">{r.course}</p>
                </div>
              </div>
              <div className="text-right">
                {statusBadge(r.status)}
                <p className="mt-1 text-xs text-slate-400">{r.date}</p>
                <p className="text-[11px] text-slate-400">{r.timeAgo}</p>
              </div>
            </div>

            {/* Card body */}
            <div className="px-6 py-4">
              {/* Work type chips */}
              <div className="flex flex-wrap gap-1.5">
                {r.workTypes.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                  >
                    {t}
                  </span>
                ))}
              </div>

              {/* Photos */}
              <p className="mb-2.5 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                작업 사진
              </p>
              <div className="flex flex-wrap gap-4">
                <button
                  type="button"
                  className="group text-left"
                  onClick={() =>
                    setViewer({ urls: [r.beforeUrl, r.afterUrl], i: 0, cap: '작업 전' })
                  }
                >
                  <div className="overflow-hidden rounded-xl border border-slate-100">
                    <img
                      src={r.beforeUrl}
                      alt=""
                      className="h-[110px] w-[150px] object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  </div>
                  <span className="mt-1.5 block text-xs text-slate-400">작업 전</span>
                </button>
                <button
                  type="button"
                  className="group text-left"
                  onClick={() =>
                    setViewer({ urls: [r.beforeUrl, r.afterUrl], i: 1, cap: '작업 후' })
                  }
                >
                  <div className="overflow-hidden rounded-xl border border-slate-100">
                    <img
                      src={r.afterUrl}
                      alt=""
                      className="h-[110px] w-[150px] object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  </div>
                  <span className="mt-1.5 block text-xs text-slate-400">작업 후</span>
                </button>
              </div>

              {/* Notes */}
              {r.notes ? (
                <div className="mt-4">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    메모
                  </p>
                  <div className="rounded-xl bg-slate-50 px-4 py-3 text-[13px] text-slate-600">
                    {r.notes}
                  </div>
                </div>
              ) : null}

              {/* Footer actions / status banner */}
              {r.status === 'pending' ? (
                <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                  <Button size="sm" onClick={() => approve(r.id)}>
                    승인
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => reject(r.id)}>
                    반려
                  </Button>
                </div>
              ) : r.status === 'approved' ? (
                <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
                  승인됨 · 승인자: {r.reviewer ?? '관리자'} · {r.date}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
                  반려됨 · {r.date}
                </div>
              )}
            </div>
          </article>
        ))}

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white py-20 text-center shadow-sm">
            <p className="text-sm text-slate-400">검색 결과가 없습니다</p>
          </div>
        ) : null}
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
