import { useMemo, useState } from 'react'
import { TrashIcon } from '@heroicons/react/24/outline'
import {
  TASK_TYPES,
  ZONES,
  type TaskKey,
  type ZoneKey,
  type ZoneTaskForm,
} from '../../constants/dailyPlan'
import type { AppUser } from '../../types/api'

type Props = {
  index: number
  zoneTask: ZoneTaskForm
  workers: AppUser[]
  onUpdate: (clientId: string, patch: Partial<ZoneTaskForm>) => void
  onDelete: (clientId: string) => void
}

const inputClass =
  'h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] outline-none focus:border-[#1B5E20]'
const chipClass =
  'inline-flex items-center gap-1 rounded-full border border-[#BBF7D0] bg-[#F0FDF4] px-2.5 py-1 text-xs font-medium text-[#166534]'

export function ZoneTaskRow({
  index,
  zoneTask,
  workers,
  onUpdate,
  onDelete,
}: Props) {
  const [workerSearch, setWorkerSearch] = useState('')
  const [showWorkerList, setShowWorkerList] = useState(false)

  const filteredWorkers = useMemo(() => {
    const q = workerSearch.trim().toLowerCase()
    if (!q) return workers
    return workers.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.email.toLowerCase().includes(q),
    )
  }, [workers, workerSearch])

  const selectedWorkers = workers.filter((w) =>
    zoneTask.assigned_worker_ids.includes(w.id),
  )

  function toggleTask(task: TaskKey) {
    const has = zoneTask.task_types.includes(task)
    const task_types = has
      ? zoneTask.task_types.filter((t) => t !== task)
      : [...zoneTask.task_types, task]
    onUpdate(zoneTask.clientId, { task_types })
  }

  function addWorker(workerId: string) {
    if (zoneTask.assigned_worker_ids.includes(workerId)) return
    onUpdate(zoneTask.clientId, {
      assigned_worker_ids: [...zoneTask.assigned_worker_ids, workerId],
    })
    setWorkerSearch('')
    setShowWorkerList(false)
  }

  function removeWorker(workerId: string) {
    onUpdate(zoneTask.clientId, {
      assigned_worker_ids: zoneTask.assigned_worker_ids.filter(
        (id) => id !== workerId,
      ),
    })
  }

  return (
    <article className="rounded-2xl border border-[#EEEEEE] border-l-4 border-l-[#1B5E20] bg-white p-4 shadow-[var(--shadow-gc-card)]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-xs font-semibold text-[#6B7280]">
            구역 {index + 1}
          </p>
          <select
            value={zoneTask.zone}
            onChange={(e) =>
              onUpdate(zoneTask.clientId, {
                zone: e.target.value as ZoneKey | '',
              })
            }
            className={inputClass}
          >
            <option value="">구역 선택 (Select zone)</option>
            {ZONES.map((z) => (
              <option key={z.key} value={z.key}>
                {z.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => onDelete(zoneTask.clientId)}
          className="rounded-lg p-2 text-[#EF4444] transition hover:bg-[#FEF2F2]"
          aria-label="구역 삭제"
          title="삭제"
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      </div>

      <p className="mb-2 text-xs font-bold text-[#374151]">작업 유형</p>
      <div className="flex flex-wrap gap-2">
        {TASK_TYPES.map((task) => {
          const checked = zoneTask.task_types.includes(task.key)
          return (
            <label
              key={task.key}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                checked
                  ? 'border-[#1B5E20] bg-[#F0FDF4] text-[#166534]'
                  : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#BBF7D0]'
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={() => toggleTask(task.key)}
              />
              {task.label}
            </label>
          )
        })}
      </div>

      {zoneTask.task_types.includes('mowing') ? (
        <div className="mt-3 flex items-center gap-2">
          <label className="shrink-0 text-xs font-bold text-[#374151]">
            예초 높이
          </label>
          <input
            type="number"
            min={0}
            value={zoneTask.mowing_height_mm}
            onChange={(e) =>
              onUpdate(zoneTask.clientId, { mowing_height_mm: e.target.value })
            }
            className="h-9 w-24 rounded-lg border border-[#E5E7EB] px-2 text-sm outline-none focus:border-[#1B5E20]"
            placeholder="0"
          />
          <span className="text-xs text-[#6B7280]">mm</span>
        </div>
      ) : null}

      <div className="relative mt-4">
        <p className="mb-1.5 text-xs font-bold text-[#374151]">담당자</p>
        <input
          type="search"
          value={workerSearch}
          onChange={(e) => {
            setWorkerSearch(e.target.value)
            setShowWorkerList(true)
          }}
          onFocus={() => setShowWorkerList(true)}
          placeholder="담당자 검색..."
          className={inputClass}
        />
        {showWorkerList && filteredWorkers.length > 0 ? (
          <ul className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-[#EEEEEE] bg-white py-1 shadow-[var(--shadow-gc-elevated)]">
            {filteredWorkers.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-[#374151] hover:bg-[#F9FAFB]"
                  onClick={() => addWorker(w.id)}
                >
                  {w.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {selectedWorkers.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selectedWorkers.map((w) => (
              <span key={w.id} className={chipClass}>
                {w.name}
                <button
                  type="button"
                  className="text-[#166534]/70 hover:text-[#DC2626]"
                  onClick={() => removeWorker(w.id)}
                  aria-label={`${w.name} 제거`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-3">
        <input
          type="text"
          value={zoneTask.notes}
          onChange={(e) =>
            onUpdate(zoneTask.clientId, { notes: e.target.value })
          }
          placeholder="메모 (선택사항)"
          className={inputClass}
        />
      </div>
    </article>
  )
}
