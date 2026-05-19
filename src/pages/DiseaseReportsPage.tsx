import { useState } from 'react'
import toast from 'react-hot-toast'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { PhotoViewerModal } from '../components/PhotoViewerModal'
import { mockDiseases, type MockDisease } from '../data/mockData'

function severityBadge(s: NonNullable<MockDisease['severity']>) {
  const map = {
    low: 'healthy' as const,
    moderate: 'pending' as const,
    high: 'disease' as const,
    critical: 'rejected' as const,
  }
  const label = {
    low: '낮음',
    moderate: '보통',
    high: '높음',
    critical: '심각',
  }
  return <Badge variant={map[s]}>{label[s]}</Badge>
}

function statusLabel(status: MockDisease['status']) {
  if (status === 'completed') return '분석 완료'
  if (status === 'approved') return '승인됨'
  return '플래그'
}

export function DiseaseReportsPage() {
  const [items] = useState(mockDiseases)
  const [viewer, setViewer] = useState<{
    urls: string[]
    i: number
    cap: string
  } | null>(null)

  return (
    <div className="mx-auto max-w-[1280px] space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">질병 분석</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          AI 분석 결과를 검토하고 조치하세요
        </p>
      </div>

      <div className="space-y-3">
        {items.map((d) => (
          <article
            key={d.id}
            className="rounded-2xl border border-[#EEEEEE] bg-white p-5 shadow-[var(--shadow-gc-card)] transition-all duration-150 hover:-translate-y-px hover:shadow-[var(--shadow-gc-elevated)] md:px-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#F3F4F6] pb-4">
              <div className="flex gap-3">
                <span className="text-[32px] leading-none" aria-hidden>
                  {d.healthy ? '✅' : '⚠️'}
                </span>
                <div>
                  {d.healthy ? (
                    <p className="text-lg font-bold text-[#16A34A]">
                      잔디 상태 양호
                    </p>
                  ) : (
                    <p className="text-lg font-bold text-[#EA580C]">
                      {d.diseaseNameKo}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <Badge variant={d.status === 'completed' ? 'info' : 'approved'}>
                  {statusLabel(d.status)}
                </Badge>
                <p className="mt-1 text-[13px] text-[#9CA3AF]">{d.date}</p>
              </div>
            </div>

            <div className="mt-4 rounded-[10px] bg-[#F9FAFB] px-4 py-3.5">
              <p className="mb-3 text-xs font-semibold tracking-wide text-[#9CA3AF]">
                AI 분석 결과
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-[#6B7280]">신뢰도</p>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
                    <div
                      className={`h-full rounded-full ${d.healthy ? 'bg-[#10B981]' : 'bg-[#F97316]'}`}
                      style={{ width: `${d.confidence}%` }}
                    />
                  </div>
                  <p className="mt-1 text-sm font-semibold text-[#111827]">
                    {d.confidence}%
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!d.healthy && d.severity ? (
                    <>
                      <span className="text-xs text-[#6B7280]">심각도</span>
                      {severityBadge(d.severity)}
                    </>
                  ) : null}
                  {!d.healthy && d.affectedPercent != null ? (
                    <span className="text-sm text-[#374151]">
                      피해 면적{' '}
                      <strong>{d.affectedPercent}%</strong>
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <p className="mb-2 mt-5 text-xs font-medium text-[#6B7280]">
              촬영 이미지 (6장)
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {d.photos.map((p, idx) => (
                <button
                  key={p.url}
                  type="button"
                  className="text-left"
                  onClick={() =>
                    setViewer({
                      urls: d.photos.map((x) => x.url),
                      i: idx,
                      cap: p.angle,
                    })
                  }
                >
                  <div className="aspect-square overflow-hidden rounded-lg border border-[#EEEEEE]">
                    <img
                      src={p.url}
                      alt=""
                      className="h-full w-full object-cover transition hover:scale-105"
                    />
                  </div>
                  <span className="mt-1 block text-[11px] text-[#6B7280]">
                    {p.angle}
                  </span>
                </button>
              ))}
            </div>

            <div
              className={`mt-4 rounded-[10px] px-4 py-3.5 ${
                d.healthy
                  ? 'bg-[#F0FDF4]'
                  : 'bg-[#FFFBEB] border border-[#FDE68A]'
              }`}
            >
              <p className="text-sm text-[#374151]">{d.recommendationKo}</p>
            </div>

            {!d.healthy ? (
              <div className="mt-4 flex gap-2 border-t border-[#F3F4F6] pt-4">
                <Button
                  size="sm"
                  onClick={() =>
                    toast.success('검토가 기록되었습니다.', {
                      className: 'gc-toast-success',
                    })
                  }
                >
                  승인 기록
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    toast('플래그 처리되었습니다.', {
                      className: 'gc-toast-info',
                    })
                  }
                >
                  플래그
                </Button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {viewer ? (
        <PhotoViewerModal
          open
          images={viewer.urls}
          index={viewer.i}
          caption={viewer.cap}
          onClose={() => setViewer(null)}
          onIndexChange={(i) => setViewer((v) => (v ? { ...v, i } : v))}
        />
      ) : null}
    </div>
  )
}
