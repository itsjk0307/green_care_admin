import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { formatKoreanScanDate } from '../../lib/formatScanDate'
import { statusBadge } from '../../lib/droneScanUi'
import { getScanDetail } from '../../services/droneScanService'
import { scanResults } from '../../types/droneScan'
import { ApiError } from '../../api/client'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { DiseaseOverlay } from './DiseaseOverlay'
import { ScanResultCard } from './ScanResultCard'

type Props = {
  scanId: string
}

export function ScanDetailView({ scanId }: Props) {
  const detailQuery = useQuery({
    queryKey: ['drone-scan', scanId],
    queryFn: () => getScanDetail(scanId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'processing' || status === 'uploaded') return 10_000
      return false
    },
  })

  useEffect(() => {
    if (detailQuery.isError) {
      const message =
        detailQuery.error instanceof ApiError
          ? detailQuery.error.message
          : '스캔 상세를 불러오지 못했습니다.'
      toast.error(message, { className: 'gc-toast-error' })
    }
  }, [detailQuery.isError, detailQuery.error])

  if (detailQuery.isLoading) {
    return <LoadingSpinner message="스캔 상세 불러오는 중…" />
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <p className="text-sm text-[#DC2626]">스캔 상세를 불러오지 못했습니다.</p>
    )
  }

  const scan = detailQuery.data
  const results = scanResults(scan)
  const badge = statusBadge(scan.status)
  const resultCount = scan.result_count ?? results.length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#EEEEEE] bg-[#F9FAFB] px-4 py-3 text-sm">
        <span className="font-bold text-[#111827]">
          {formatKoreanScanDate(scan.scan_date)}
        </span>
        <span className="text-[#D1D5DB]">|</span>
        <span className="text-[#6B7280]">
          {scan.uploaded_by_name ?? '업로더 미상'}
        </span>
        <span className="text-[#D1D5DB]">|</span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}
        >
          {badge.spinning ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#F59E0B] border-t-transparent" />
          ) : null}
          {badge.label}
        </span>
        <span className="text-[#D1D5DB]">|</span>
        <span className="font-semibold text-[#374151]">
          결과 {resultCount}건
        </span>
      </div>

      {(scan.status === 'processing' || scan.status === 'uploaded') && (
        <div className="flex items-center gap-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#F59E0B] border-t-transparent" />
          AI 분석이 진행 중입니다. 잠시 후 새로고침됩니다.
        </div>
      )}

      <DiseaseOverlay scan={scan} />

      {results.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#E5E7EB] py-8 text-center text-sm text-[#6B7280]">
          {scan.status === 'completed'
            ? '분석 결과가 없습니다.'
            : '분석 결과를 기다리는 중입니다.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {results.map((result) => (
            <ScanResultCard key={result.id} result={result} />
          ))}
        </div>
      )}
    </div>
  )
}
