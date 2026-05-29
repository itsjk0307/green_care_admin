import { useQuery } from '@tanstack/react-query'
import { useRef } from 'react'
import { pinPositionClass } from '../../lib/issueUi'
import { getGolfCourse, resolveStorageUrl } from '../../services/issueService'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { IssuePinMarker } from './IssuePinMarker'
import type { Issue, PinPosition } from '../../types/issue'

type Props = {
  courseId: string
  issues: Issue[]
  selectedIssueId: string | null
  registerMode: boolean
  onPinClick: (issueId: string) => void
  onMapClick: (pin: PinPosition) => void
}

export function IssueMapView({
  courseId,
  issues,
  selectedIssueId,
  registerMode,
  onPinClick,
  onMapClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  const courseQuery = useQuery({
    queryKey: ['golf-course', courseId],
    queryFn: () => getGolfCourse(courseId),
    enabled: Boolean(courseId),
  })

  const mapSrc = resolveStorageUrl(courseQuery.data?.map_image_path)

  function handleMapClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!registerMode || !containerRef.current) return
    const target = event.target as HTMLElement
    if (target.closest('[data-issue-pin]')) return

    const rect = containerRef.current.getBoundingClientRect()
    const offsetX = event.clientX - rect.left
    const offsetY = event.clientY - rect.top
    const pin_x = (offsetX / rect.width) * 100
    const pin_y = (offsetY / rect.height) * 100
    onMapClick({ pin_x, pin_y })
  }

  if (!courseId) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center rounded-2xl border border-dashed border-[#E5E7EB] bg-[#F9FAFB] text-sm text-[#6B7280]">
        골프장을 선택하세요
      </div>
    )
  }

  if (courseQuery.isLoading) {
    return <LoadingSpinner message="코스 지도 불러오는 중…" />
  }

  if (courseQuery.isError || !mapSrc) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center rounded-2xl border border-dashed border-[#E5E7EB] bg-[#F9FAFB] text-sm text-[#6B7280]">
        코스 지도 이미지를 불러올 수 없습니다
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      role="presentation"
      onClick={handleMapClick}
      className={`relative w-full overflow-hidden rounded-2xl border border-[#EEEEEE] bg-[#F7F8F7] shadow-[var(--shadow-gc-card)] ${
        registerMode ? 'cursor-crosshair' : 'cursor-default'
      }`}
    >
      {registerMode ? (
        <p className="absolute left-3 top-3 z-20 rounded-lg bg-[#1B5E20] px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
          지도에서 이슈 위치를 클릭하세요
        </p>
      ) : null}

      <img
        src={mapSrc}
        alt="골프장 지도"
        className="block h-auto w-full select-none"
        draggable={false}
      />

      {issues.map((issue) => (
        <div
          key={issue.id}
          data-issue-pin
          className={pinPositionClass(issue.pin_x, issue.pin_y)}
        >
          <IssuePinMarker
            issue={issue}
            isSelected={issue.id === selectedIssueId}
            onClick={() => onPinClick(issue.id)}
          />
        </div>
      ))}
    </div>
  )
}
