import {
  affectedPercent,
  confidencePercent,
  confidenceWidthClass,
  diseaseDisplayName,
  holeLabel,
  severityBadgeLabel,
  severityBorderClass,
} from '../../lib/droneScanUi'
import type { DroneScanResult } from '../../types/droneScan'

type Props = {
  result: DroneScanResult
}

export function ScanResultCard({ result }: Props) {
  const isHealthy = result.disease_type === 'healthy'

  if (isHealthy) {
    return (
      <article className="rounded-2xl border border-[#EEEEEE] border-l-4 border-l-[#10B981] bg-white p-4 shadow-[var(--shadow-gc-card)]">
        <p className="text-[15px] font-bold text-[#111827]">
          <span aria-hidden>✅ </span>
          {holeLabel(result)} — 정상
        </p>
        <p className="mt-2 text-sm text-[#6B7280]">현재 상태 양호</p>
      </article>
    )
  }

  const pct = confidencePercent(result.confidence)

  return (
    <article
      className={`rounded-2xl border border-[#EEEEEE] border-l-4 bg-white p-4 shadow-[var(--shadow-gc-card)] ${severityBorderClass(result.severity)}`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#F0FDF4] px-2.5 py-0.5 text-xs font-bold text-[#166534]">
          {holeLabel(result)}
        </span>
        <span className="text-[15px] font-bold text-[#111827]">
          {diseaseDisplayName(result)}
        </span>
        <span className="rounded-full border border-[#FECACA] bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-semibold text-[#DC2626]">
          {severityBadgeLabel(result.severity)}
        </span>
      </div>

      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-semibold text-[#6B7280]">정확도</span>
          <span className="font-bold text-[#111827]">{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
          <div
            className={`h-full rounded-full bg-[#10B981] transition-all ${confidenceWidthClass(pct)}`}
          />
        </div>
      </div>

      <p className="text-sm text-[#374151]">
        영향 면적: {affectedPercent(result)}
      </p>

      <hr className="my-3 border-[#F3F4F6]" />

      <p className="text-xs font-bold text-[#6B7280]">조치 사항</p>
      <p className="mt-1 text-sm leading-relaxed text-[#374151]">
        {result.recommendation_ko ??
          result.recommendation ??
          '권장 조치 정보 없음'}
      </p>
    </article>
  )
}
