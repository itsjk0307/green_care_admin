import { useState } from 'react'
import {
  ISSUE_TYPE_META,
  PRIORITY_META,
  pinSizeClass,
  timeAgo,
  truncateTitle,
} from '../../lib/issueUi'
import type { Issue } from '../../types/issue'

type Props = {
  issue: Issue
  isSelected: boolean
  onClick: () => void
}

function PinSvg({ color, className }: { color: string; className: string }) {
  return (
    <svg
      viewBox="0 0 24 32"
      className={className}
      aria-hidden
      fill={color}
    >
      <path d="M12 0C7.03 0 3 4.03 3 9c0 6.75 9 23 9 23s9-16.25 9-23c0-4.97-4.03-9-9-9zm0 13a4 4 0 110-8 4 4 0 010 8z" />
    </svg>
  )
}

export function IssuePinMarker({ issue, isSelected, onClick }: Props) {
  const [hovered, setHovered] = useState(false)
  const typeMeta = ISSUE_TYPE_META[issue.issue_type]
  const priorityMeta = PRIORITY_META[issue.priority]
  const resolved = issue.status === 'resolved'
  const isCritical = issue.priority === 'critical' && !resolved

  return (
    <button
      type="button"
      className={`group relative z-10 ${resolved ? 'opacity-40' : 'opacity-100'}`}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-label={issue.title}
    >
      {isCritical ? (
        <span
          className="absolute inset-0 animate-ping rounded-full bg-[#EF4444]/40"
          aria-hidden
        />
      ) : null}

      <span
        className={`relative flex items-center justify-center rounded-full ${
          isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1B5E20]' : ''
        }`}
      >
        <PinSvg color={typeMeta.color} className={pinSizeClass(issue.priority)} />
        {resolved ? (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#10B981] text-[10px] text-white">
            ✓
          </span>
        ) : null}
      </span>

      {hovered ? (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-48 -translate-x-1/2 rounded-xl border border-[#EEEEEE] bg-white p-3 text-left shadow-[var(--shadow-gc-elevated)]">
          <p className="text-sm font-bold text-[#111827]">
            {truncateTitle(issue.title)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${typeMeta.badgeClass}`}
            >
              {typeMeta.emoji} {typeMeta.label}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priorityMeta.badgeClass}`}
            >
              {priorityMeta.label}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[#6B7280]">{timeAgo(issue.created_at)}</p>
        </div>
      ) : null}
    </button>
  )
}
