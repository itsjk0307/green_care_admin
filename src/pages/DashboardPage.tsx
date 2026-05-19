import { Link } from 'react-router-dom'
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BeakerIcon,
  ClipboardDocumentListIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { mockStats, mockWorkReports, mockDiseases } from '../data/mockData'
import { initials } from '../lib/formatKoreanDate'

function StatCard({
  label,
  value,
  trend,
  iconBg,
  iconColor,
  Icon,
}: {
  label: string
  value: number
  trend: number
  iconBg: string
  iconColor: string
  Icon: typeof ClipboardDocumentListIcon
}) {
  const up = trend >= 0
  return (
    <Card padding="lg" className="hover:-translate-y-px hover:shadow-[var(--shadow-gc-elevated)]">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold tracking-wide text-[#6B7280]">
          {label}
        </p>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full ${iconBg}`}
        >
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
      <p className="mt-4 text-[32px] font-bold leading-none text-[#111827]">
        {value}
      </p>
      <p className="mt-2 flex items-center gap-1 text-xs font-medium">
        {up ? (
          <ArrowTrendingUpIcon className="h-4 w-4 text-[#10B981]" />
        ) : (
          <ArrowTrendingDownIcon className="h-4 w-4 text-[#EF4444]" />
        )}
        <span className={up ? 'text-[#10B981]' : 'text-[#EF4444]'}>
          {up ? '↑' : '↓'} {up ? '+' : ''}
          {trend}%{' '}
          <span className="font-normal text-[#9CA3AF]">전월 대비</span>
        </span>
      </p>
    </Card>
  )
}

function statusBadge(status: string) {
  if (status === 'pending') return <Badge variant="pending">대기중</Badge>
  if (status === 'approved') return <Badge variant="approved">승인됨</Badge>
  return <Badge variant="rejected">반려됨</Badge>
}

export function DashboardPage() {
  const recentReports = mockWorkReports.slice(0, 3)
  const diseaseRows = mockDiseases.slice(0, 3)

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="작업 보고서"
          value={mockStats.reports.value}
          trend={mockStats.reports.trend}
          iconBg="bg-[#F0FDF4]"
          iconColor="text-[#16A34A]"
          Icon={ClipboardDocumentListIcon}
        />
        <StatCard
          label="승인 대기"
          value={mockStats.pending.value}
          trend={mockStats.pending.trend}
          iconBg="bg-[#FFFBEB]"
          iconColor="text-[#D97706]"
          Icon={ClipboardDocumentListIcon}
        />
        <StatCard
          label="질병 알림"
          value={mockStats.diseaseAlerts.value}
          trend={mockStats.diseaseAlerts.trend}
          iconBg="bg-[#FFF7ED]"
          iconColor="text-[#EA580C]"
          Icon={BeakerIcon}
        />
        <StatCard
          label="현장 작업자"
          value={mockStats.workers.value}
          trend={mockStats.workers.trend}
          iconBg="bg-[#EFF6FF]"
          iconColor="text-[#2563EB]"
          Icon={UserGroupIcon}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3" padding="lg">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#111827]">
              최근 작업 보고서
            </h2>
            <Link
              to="/work-reports"
              className="text-sm font-semibold text-[#1B5E20] hover:underline"
            >
              전체보기 →
            </Link>
          </div>
          <div className="divide-y divide-[#F3F4F6]">
            {recentReports.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1B5E20] text-xs font-bold text-white">
                  {initials(r.workerName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#111827]">
                    {r.workerName}
                  </p>
                  <p className="truncate text-xs text-[#6B7280]">
                    {r.workTypes.join(', ')}
                  </p>
                </div>
                <p className="hidden w-32 shrink-0 text-center text-xs text-[#6B7280] sm:block">
                  {r.course}
                </p>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {statusBadge(r.status)}
                  <span className="text-[11px] text-[#9CA3AF]">{r.timeAgo}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2" padding="lg">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-[#111827]">
              질병 분석 현황
            </h2>
          </div>
          <div className="space-y-4">
            {diseaseRows.map((d) => (
              <div key={d.id} className="border-b border-[#F3F4F6] pb-4 last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex gap-2">
                    <span className="text-2xl leading-none" aria-hidden>
                      {d.healthy ? '✅' : '⚠️'}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">
                        {d.healthy
                          ? '잔디 상태 양호'
                          : d.diseaseNameKo ?? '질병 감지'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-[#9CA3AF]">{d.timeAgo}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F3F4F6]">
                  <div
                    className={`h-full rounded-full ${d.healthy ? 'bg-[#10B981]' : 'bg-[#F97316]'}`}
                    style={{ width: `${d.confidence}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-[11px] text-[#6B7280]">
                  신뢰도 {d.confidence}%
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
