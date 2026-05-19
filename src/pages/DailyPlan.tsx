import { useState } from 'react'
import { CreatePlanTab } from './daily-plan/CreatePlanTab'
import { StatusBoardTab } from './daily-plan/StatusBoardTab'

type TabId = 'create' | 'board'

const tabs: { id: TabId; label: string }[] = [
  { id: 'create', label: '계획 작성' },
  { id: 'board', label: '현황 보드' },
]

export function DailyPlanPage() {
  const [activeTab, setActiveTab] = useState<TabId>('create')

  return (
    <div className="page-enter mx-auto max-w-[1280px] space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">일일 작업 계획</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          오늘의 현장 작업 계획을 작성하고 현황을 확인하세요
        </p>
      </div>

      <div className="flex gap-1 rounded-xl border border-[#EEEEEE] bg-white p-1 shadow-[var(--shadow-gc-card)]">
        {tabs.map((tab) => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                active
                  ? 'bg-[#1B5E20] text-white shadow-sm'
                  : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#374151]'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'create' ? (
        <CreatePlanTab onSaved={() => setActiveTab('board')} />
      ) : (
        <StatusBoardTab onSwitchToCreate={() => setActiveTab('create')} />
      )}
    </div>
  )
}
