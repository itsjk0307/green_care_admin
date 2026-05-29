import { useState } from 'react'
import {
  bboxPositionClass,
  diseaseDisplayName,
  holeLabel,
  overlayBoxClass,
  confidencePercent,
  affectedPercent,
  severityBadgeLabel,
} from '../../lib/droneScanUi'
import { getDroneStorageImageUrl } from '../../services/droneScanService'
import { scanResults, type DroneScanDetail } from '../../types/droneScan'

type Props = {
  scan: DroneScanDetail
}

function hasBbox(result: {
  bbox_x?: number | null
  bbox_y?: number | null
  bbox_width?: number | null
  bbox_height?: number | null
}): boolean {
  return (
    result.bbox_x != null &&
    result.bbox_y != null &&
    result.bbox_width != null &&
    result.bbox_height != null
  )
}

export function DiseaseOverlay({ scan }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const imagePath = scan.image_path ?? scan.image_url
  const src = getDroneStorageImageUrl(imagePath)
  const results = scanResults(scan).filter(
    (r) => r.disease_type !== 'healthy' && hasBbox(r),
  )
  const hovered = results.find((r) => r.id === hoveredId)

  if (!src) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-[#E5E7EB] bg-[#F9FAFB] text-sm text-[#6B7280]">
        이미지 없음
      </div>
    )
  }

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-[#EEEEEE] bg-[#111827]/5 shadow-[var(--shadow-gc-card)]">
      <div className="relative w-full">
        <img
          src={src}
          alt="드론 스캔 이미지"
          className="block h-auto w-full"
        />
        {results.map((result) => (
          <div
            key={result.id}
            className={`${bboxPositionClass(
              result.bbox_x!,
              result.bbox_y!,
              result.bbox_width!,
              result.bbox_height!,
            )} cursor-pointer ${overlayBoxClass(result.severity)}`}
            onMouseEnter={() => setHoveredId(result.id)}
            onMouseLeave={() => setHoveredId(null)}
            onFocus={() => setHoveredId(result.id)}
            onBlur={() => setHoveredId(null)}
            tabIndex={0}
            role="button"
            aria-label={`${holeLabel(result)} ${diseaseDisplayName(result)}`}
          >
            <span className="absolute left-0 top-0 max-w-full truncate rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-[#111827]">
              {holeLabel(result)} {diseaseDisplayName(result)}
            </span>
          </div>
        ))}
      </div>

      {hovered ? (
        <div className="absolute bottom-3 left-3 z-20 max-w-xs rounded-xl border border-[#EEEEEE] bg-white px-4 py-3 text-xs shadow-[var(--shadow-gc-elevated)]">
          <p className="font-bold text-[#111827]">홀: {holeLabel(hovered)}</p>
          <p className="mt-1 text-[#374151]">
            병해: {diseaseDisplayName(hovered)}
          </p>
          <p className="mt-0.5 text-[#374151]">
            정확도: {confidencePercent(hovered.confidence)}%
          </p>
          <p className="mt-0.5 text-[#374151]">
            심각도: {severityBadgeLabel(hovered.severity)}
          </p>
          <p className="mt-0.5 text-[#374151]">
            영향 면적: {affectedPercent(hovered)}
          </p>
          {hovered.recommendation_ko || hovered.recommendation ? (
            <p className="mt-1 border-t border-[#F3F4F6] pt-1 text-[#374151]">
              조치: {hovered.recommendation_ko ?? hovered.recommendation}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
