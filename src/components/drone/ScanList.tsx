import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { formatKoreanScanDate } from '../../lib/formatScanDate'
import { statusBadge } from '../../lib/droneScanUi'
import { getDroneScans } from '../../services/droneScanService'
import { ApiError } from '../../api/client'
import type { DroneScanSummary } from '../../types/droneScan'

type Props = {
  courseId: string
  selectedScanId: string | null
  onSelect: (scanId: string) => void
}

function ScanListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-[#EEEEEE] bg-[#F9FAFB] p-4"
        >
          <div className="mb-2 h-4 w-2/3 rounded bg-[#E5E7EB]" />
          <div className="mb-2 h-3 w-1/2 rounded bg-[#E5E7EB]" />
          <div className="h-6 w-20 rounded-full bg-[#E5E7EB]" />
        </div>
      ))}
    </div>
  )
}

function ScanCard({
  scan,
  selected,
  onSelect,
}: {
  scan: DroneScanSummary
  selected: boolean
  onSelect: () => void
}) {
  const badge = statusBadge(scan.status)
  const resultCount = scan.result_count ?? 0

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
        selected
          ? 'border-l-4 border-l-[#1B5E20] border-[#BBF7D0] bg-[#F0FDF4]'
          : 'border-[#EEEEEE] bg-white hover:bg-[#F9FAFB]'
      }`}
    >
      <p className="text-sm font-bold text-[#111827]">
        📅 {formatKoreanScanDate(scan.scan_date)}
      </p>
      <p className="mt-1 text-xs text-[#6B7280]">
        결과: {scan.status === 'completed' ? `${resultCount}개 발견` : '—'}
      </p>
      <div className="mt-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}
        >
          {badge.spinning ? (
            <span
              className="h-3 w-3 animate-spin rounded-full border-2 border-[#F59E0B] border-t-transparent"
              aria-hidden
            />
          ) : scan.status === 'completed' ? (
            <span aria-hidden>✅</span>
          ) : null}
          {badge.label}
        </span>
      </div>
      {scan.uploaded_by_name ? (
        <p className="mt-2 text-xs text-[#9CA3AF]">
          {scan.uploaded_by_name} 업로드
        </p>
      ) : null}
    </button>
  )
}

export function ScanList({ courseId, selectedScanId, onSelect }: Props) {
  const scansQuery = useQuery({
    queryKey: ['drone-scans', courseId],
    queryFn: () => getDroneScans(courseId),
    enabled: Boolean(courseId),
    refetchInterval: (query) => {
      const list = query.state.data
      if (list?.some((s) => s.status === 'processing' || s.status === 'uploaded')) {
        return 30_000
      }
      return false
    },
  })

  useEffect(() => {
    if (scansQuery.isError) {
      const message =
        scansQuery.error instanceof ApiError
          ? scansQuery.error.message
          : '스캔 목록을 불러오지 못했습니다.'
      toast.error(message, { className: 'gc-toast-error' })
    }
  }, [scansQuery.isError, scansQuery.error])

  if (!courseId) {
    return (
      <p className="py-8 text-center text-sm text-[#6B7280]">
        골프장을 선택하세요
      </p>
    )
  }

  if (scansQuery.isLoading) {
    return <ScanListSkeleton />
  }

  if (scansQuery.isError) {
    return (
      <p className="py-8 text-center text-sm text-[#DC2626]">
        스캔 목록을 불러오지 못했습니다
      </p>
    )
  }

  const scans = scansQuery.data ?? []

  if (scans.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[#E5E7EB] py-10 text-center text-sm text-[#6B7280]">
        스캔 기록이 없습니다
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {scans.map((scan) => (
        <li key={scan.id}>
          <ScanCard
            scan={scan}
            selected={scan.id === selectedScanId}
            onSelect={() => onSelect(scan.id)}
          />
        </li>
      ))}
    </ul>
  )
}
