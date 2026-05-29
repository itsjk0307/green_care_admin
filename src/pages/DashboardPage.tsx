import { Link } from 'react-router-dom'
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BeakerIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  UserGroupIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'
import type { ComponentType, SVGProps } from 'react'
import { Badge } from '../components/ui/Badge'
import { mockStats, mockWorkReports, mockDiseases } from '../data/mockData'
import { initials } from '../lib/formatKoreanDate'
import { useLanguageStore } from '../stores/languageStore'

type HeroIcon = ComponentType<SVGProps<SVGSVGElement> & { title?: string }>

function StatCard({
  label,
  value,
  trend,
  trendLabel,
  accentBar,
  iconBg,
  iconColor,
  Icon,
}: {
  label: string
  value: number
  trend: number
  trendLabel: string
  accentBar: string
  iconBg: string
  iconColor: string
  Icon: HeroIcon
}) {
  const up = trend >= 0
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className={`absolute left-0 top-0 h-full w-1 ${accentBar}`} />
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          {label}
        </p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold leading-none text-slate-900">{value}</p>
      <div className="mt-2.5 flex items-center gap-1.5">
        {up ? (
          <ArrowTrendingUpIcon className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <ArrowTrendingDownIcon className="h-3.5 w-3.5 text-red-500" />
        )}
        <span className={`text-xs font-semibold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
          {up ? '+' : ''}{trend}%
        </span>
        <span className="text-xs text-slate-400">{trendLabel}</span>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguageStore()
  if (status === 'pending') return <Badge variant="pending">{t('pending')}</Badge>
  if (status === 'approved') return <Badge variant="approved">{t('approved')}</Badge>
  return <Badge variant="rejected">{t('rejected')}</Badge>
}

export function DashboardPage() {
  const { t } = useLanguageStore()
  const recentReports = mockWorkReports.slice(0, 3)
  const diseaseRows = mockDiseases.slice(0, 3)

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] min-h-[640px] max-w-[1440px] flex-col gap-4">
      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('totalReports')}
          value={mockStats.reports.value}
          trend={mockStats.reports.trend}
          trendLabel={t('vsLastMonth')}
          accentBar="bg-emerald-500"
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          Icon={ClipboardDocumentCheckIcon}
        />
        <StatCard
          label={t('pendingApproval')}
          value={mockStats.pending.value}
          trend={mockStats.pending.trend}
          trendLabel={t('vsLastMonth')}
          accentBar="bg-amber-400"
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          Icon={ClipboardDocumentListIcon}
        />
        <StatCard
          label={t('diseaseAlert')}
          value={mockStats.diseaseAlerts.value}
          trend={mockStats.diseaseAlerts.trend}
          trendLabel={t('vsLastMonth')}
          accentBar="bg-orange-500"
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
          Icon={BeakerIcon}
        />
        <StatCard
          label={t('activeWorkers')}
          value={mockStats.workers.value}
          trend={mockStats.workers.trend}
          trendLabel={t('vsLastMonth')}
          accentBar="bg-blue-500"
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          Icon={UserGroupIcon}
        />
      </div>

      {/* ── Content panels — stretch to fill remaining height ── */}
      <div className="grid flex-1 min-h-0 grid-cols-[3fr_2fr] gap-6">
        {/* Recent work reports */}
        <div className="flex flex-col h-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex shrink-0 items-center justify-between px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {t('recentWorkReports')}
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">{t('recentSubmitted')}</p>
            </div>
            <Link
              to="/work-reports"
              className="flex items-center gap-1 text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-700"
            >
              {t('viewAll')}
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 px-6 pb-4">
            {recentReports.map((r, i) => (
              <div
                key={r.id}
                className={`-mx-2 flex items-center gap-3 rounded-xl px-2 py-3.5 transition-colors first:pt-0 hover:bg-emerald-50/60 ${
                  i % 2 === 1 ? 'bg-slate-50/50' : ''
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                  {initials(r.workerName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{r.workerName}</p>
                  <p className="truncate text-xs text-slate-400">{r.workTypes.join(', ')}</p>
                </div>
                <p className="hidden w-28 shrink-0 text-center text-xs text-slate-400 sm:block">
                  {r.course}
                </p>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={r.status} />
                  <span className="text-[11px] text-slate-400">{r.timeAgo}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Disease analysis */}
        <div className="flex flex-col h-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="shrink-0 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              {t('diseaseAnalysisStatus')}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">{t('latestAIResult')}</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 px-6 pb-4">
            {diseaseRows.map((d) => (
              <div key={d.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                        d.healthy ? 'bg-emerald-500' : 'bg-orange-500'
                      }`}
                    />
                    <p className="text-sm font-semibold text-slate-900">
                      {d.healthy
                        ? t('turfHealthy')
                        : (d.diseaseNameKo ?? t('diseaseDetected'))}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400">{d.timeAgo}</span>
                </div>
                <div className="ml-4 mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      d.healthy ? 'bg-emerald-500' : 'bg-orange-500'
                    }`}
                    style={{ width: `${d.confidence}%` }}
                  />
                </div>
                <p className="ml-4 mt-1.5 text-right text-[11px] text-slate-400">
                  {t('confidence')}{' '}
                  <span className="font-semibold text-slate-600">{d.confidence}%</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
