import {
  ISSUE_TYPE_META,
  PRIORITY_META,
  STATUS_META,
  sortIssues,
  timeAgo,
} from '../../lib/issueUi'
import type { Issue, IssueStatus } from '../../types/issue'

type StatusFilter = IssueStatus | 'all'

type Props = {
  issues: Issue[]
  selectedIssueId: string | null
  statusFilter: StatusFilter
  onStatusFilterChange: (status: StatusFilter) => void
  onSelect: (issueId: string) => void
}

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'open', label: '열림' },
  { key: 'in_progress', label: '진행중' },
  { key: 'resolved', label: '해결됨' },
]

function filterByStatus(issues: Issue[], status: StatusFilter): Issue[] {
  if (status === 'all') return issues
  return issues.filter((i) => i.status === status)
}

export function IssueListPanel({
  issues,
  selectedIssueId,
  statusFilter,
  onStatusFilterChange,
  onSelect,
}: Props) {
  const filtered = sortIssues(filterByStatus(issues, statusFilter))

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#EEEEEE] bg-white shadow-[var(--shadow-gc-card)]">
      <div className="border-b border-[#F3F4F6] p-4">
        <h2 className="text-sm font-bold text-[#111827]">
          이슈 목록 ({filtered.length}개)
        </h2>
        <div className="mt-3 flex flex-wrap gap-1">
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onStatusFilterChange(tab.key)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  active
                    ? 'bg-[#1B5E20] text-white'
                    : 'bg-[#F9FAFB] text-[#6B7280] hover:bg-[#F3F4F6]'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <ul className="flex-1 space-y-2 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <li className="py-12 text-center text-sm text-[#6B7280]">
            해당 조건의 이슈가 없습니다
          </li>
        ) : (
          filtered.map((issue) => {
            const typeMeta = ISSUE_TYPE_META[issue.issue_type]
            const priorityMeta = PRIORITY_META[issue.priority]
            const statusMeta = STATUS_META[issue.status]
            const selected = issue.id === selectedIssueId

            return (
              <li key={issue.id}>
                <button
                  type="button"
                  onClick={() => onSelect(issue.id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    selected
                      ? 'border-l-4 border-l-[#1B5E20] border-[#BBF7D0] bg-[#F0FDF4]'
                      : 'border-[#EEEEEE] bg-white hover:bg-[#F9FAFB]'
                  }`}
                >
                  <p className="text-sm font-bold text-[#111827]">
                    {typeMeta.emoji}{' '}
                    <span
                      className={`mr-1 rounded px-1.5 py-0.5 text-[10px] ${priorityMeta.badgeClass}`}
                    >
                      {priorityMeta.label}
                    </span>
                    {issue.title}
                  </p>
                  <p className="mt-1 text-xs text-[#6B7280]">
                    {issue.reporter_name ?? '신고자 미상'} ·{' '}
                    {timeAgo(issue.created_at)}
                  </p>
                  <span
                    className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.badgeClass}`}
                  >
                    {statusMeta.label}
                  </span>
                </button>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
