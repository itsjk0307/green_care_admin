import { useQuery } from '@tanstack/react-query'
import { formatKoreanScanDate } from '../../lib/formatScanDate'
import { getPhotosByHole, resolvePhotoUrl } from '../../services/photoService'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import type { HolePhotoSummaryItem } from '../../types/photo'

type Props = {
  courseId: string
  selectedHole: number | null
  onHoleSelect: (hole: number) => void
}

function holeItemFor(
  holes: HolePhotoSummaryItem[],
  n: number,
): HolePhotoSummaryItem {
  return (
    holes.find((h) => h.hole_number === n) ?? {
      hole_number: n,
      count: 0,
    }
  )
}

export function HolePhotoSummary({
  courseId,
  selectedHole,
  onHoleSelect,
}: Props) {
  const query = useQuery({
    queryKey: ['photos-by-hole', courseId],
    queryFn: () => getPhotosByHole(courseId),
    enabled: Boolean(courseId),
  })

  if (!courseId) return null

  if (query.isLoading) {
    return <LoadingSpinner message="홀별 사진 요약 불러오는 중…" />
  }

  if (query.isError) {
    return (
      <p className="text-sm text-[#DC2626]">홀별 요약을 불러오지 못했습니다.</p>
    )
  }

  const holes = query.data ?? []
  const holeNumbers = Array.from({ length: 18 }, (_, i) => i + 1)

  return (
    <section className="rounded-2xl border border-[#EEEEEE] bg-white p-4 shadow-[var(--shadow-gc-card)]">
      <h2 className="mb-3 text-sm font-bold text-[#111827]">홀별 사진 현황</h2>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {holeNumbers.map((n) => {
          const item = holeItemFor(holes, n)
          const thumb = resolvePhotoUrl(
            item.latest_thumbnail ??
              item.latest_image_path ??
              item.latest_image_url,
          )
          const selected = selectedHole === n

          return (
            <button
              key={n}
              type="button"
              onClick={() => onHoleSelect(n)}
              className={`group relative aspect-[4/3] overflow-hidden rounded-xl border text-left transition ${
                selected
                  ? 'border-[#1B5E20] ring-2 ring-[#1B5E20]/30'
                  : 'border-[#EEEEEE] hover:border-[#BBF7D0]'
              }`}
            >
              {thumb ? (
                <img
                  src={thumb}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-[#E5E7EB] to-[#F3F4F6]" />
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-xs font-semibold text-white">
                <span>{n}홀</span>
                <span>{item.count}장</span>
              </div>
              {item.last_photo_date ? (
                <p className="absolute left-0 right-0 -bottom-5 truncate pt-1 text-center text-[10px] text-[#9CA3AF]">
                  {formatKoreanScanDate(item.last_photo_date)}
                </p>
              ) : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}
