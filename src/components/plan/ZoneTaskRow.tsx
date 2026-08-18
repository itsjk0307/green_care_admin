import { TrashIcon } from '@heroicons/react/24/outline'
import {
  DEFAULT_AERATION_MM,
  DEFAULT_MOWING_HEIGHT_MM,
  FERTILIZER_MODES,
  FUNGICIDE_TARGETS,
  MM_FIELD_TASKS,
  TASK_TYPES,
  ZONES,
  mmFieldLabelKey,
  type FertilizerMode,
  type TaskKey,
  type ZoneKey,
  type ZoneTaskForm,
} from '../../constants/dailyPlan'
import { useLanguageStore } from '../../stores/languageStore'

type Props = {
  index: number
  zoneTask: ZoneTaskForm
  onUpdate: (clientId: string, patch: Partial<ZoneTaskForm>) => void
  onDelete: (clientId: string) => void
  /** Hide zone dropdown when zone is fixed (그린/티/페어웨이 templates) */
  lockZone?: boolean
}

const inputClass =
  'h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] outline-none focus:border-[#121820]'

export function ZoneTaskRow({
  index,
  zoneTask,
  onUpdate,
  onDelete,
  lockZone = false,
}: Props) {
  const { t } = useLanguageStore()

  const showMmField = zoneTask.task_types.some((task) => MM_FIELD_TASKS.has(task))
  const showFungicide = zoneTask.task_types.includes('fungicide')
  const showFertilizer = zoneTask.task_types.includes('fertilizing')
  const zoneMeta = ZONES.find((z) => z.key === zoneTask.zone)
  const zoneLabel = zoneMeta
    ? t(zoneMeta.labelKey)
    : `${t('selectZone')} ${index + 1}`

  const workTasks = TASK_TYPES.filter((task) => task.group === 'work')
  const chemicalTasks = TASK_TYPES.filter((task) => task.group === 'chemical')

  function toggleTask(task: TaskKey) {
    const has = zoneTask.task_types.includes(task)
    const task_types = has
      ? zoneTask.task_types.filter((x) => x !== task)
      : [...zoneTask.task_types, task]

    const patch: Partial<ZoneTaskForm> = { task_types }

    if (!task_types.includes('fungicide')) patch.fungicide_targets = []
    if (!task_types.includes('fertilizing')) patch.fertilizer_mode = ''

    if (!has && task === 'mowing' && zoneTask.zone && !zoneTask.mowing_height_mm) {
      const def = DEFAULT_MOWING_HEIGHT_MM[zoneTask.zone]
      if (def != null) patch.mowing_height_mm = String(def)
    }
    if (
      !has &&
      (task === 'hollow_tine' || task === 'solid_tine') &&
      !zoneTask.mowing_height_mm
    ) {
      patch.mowing_height_mm = String(DEFAULT_AERATION_MM)
    }

    onUpdate(zoneTask.clientId, patch)
  }

  function handleZoneChange(zone: ZoneKey | '') {
    const patch: Partial<ZoneTaskForm> = { zone }
    if (
      zone &&
      zoneTask.task_types.includes('mowing') &&
      !zoneTask.mowing_height_mm
    ) {
      const def = DEFAULT_MOWING_HEIGHT_MM[zone]
      if (def != null) patch.mowing_height_mm = String(def)
    }
    onUpdate(zoneTask.clientId, patch)
  }

  function toggleFungicideTarget(id: string) {
    const has = zoneTask.fungicide_targets.includes(id)
    onUpdate(zoneTask.clientId, {
      fungicide_targets: has
        ? zoneTask.fungicide_targets.filter((x) => x !== id)
        : [...zoneTask.fungicide_targets, id],
    })
  }

  function setFertilizerMode(mode: FertilizerMode) {
    onUpdate(zoneTask.clientId, {
      fertilizer_mode: zoneTask.fertilizer_mode === mode ? '' : mode,
    })
  }

  function TaskChips({
    tasks,
  }: {
    tasks: ReadonlyArray<{ key: TaskKey; labelKey: (typeof TASK_TYPES)[number]['labelKey'] }>
  }) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {tasks.map((task) => {
          const checked = zoneTask.task_types.includes(task.key)
          return (
            <label
              key={task.key}
              className={`flex cursor-pointer items-center rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition ${
                checked
                  ? 'border-[#121820] bg-[#f4f5f7] text-[#121820]'
                  : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#c5cad1]'
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={() => toggleTask(task.key)}
              />
              {t(task.labelKey)}
            </label>
          )
        })}
      </div>
    )
  }

  return (
    <article className="flex h-full flex-col rounded-2xl border border-[#EEEEEE] border-l-4 border-l-[#121820] bg-white p-4 shadow-[var(--shadow-gc-card)]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
            {t('zoneLocation')}
          </p>
          {lockZone ? (
            <p className="text-[15px] font-bold text-slate-900">{zoneLabel}</p>
          ) : (
            <select
              value={zoneTask.zone}
              onChange={(e) =>
                handleZoneChange(e.target.value as ZoneKey | '')
              }
              className={inputClass}
            >
              <option value="">{t('selectZone')}</option>
              {ZONES.map((z) => (
                <option key={z.key} value={z.key}>
                  {t(z.labelKey)}
                </option>
              ))}
            </select>
          )}
        </div>
        {!lockZone ? (
          <button
            type="button"
            onClick={() => onDelete(zoneTask.clientId)}
            className="rounded-lg p-2 text-[#EF4444] transition hover:bg-[#FEF2F2]"
            aria-label={t('deleteZone')}
            title={t('deleteZone')}
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <p className="mb-2 text-xs font-bold text-[#374151]">{t('workItems')}</p>
      <TaskChips tasks={workTasks} />

      <p className="mb-2 mt-4 text-xs font-bold text-[#374151]">{t('chemicals')}</p>
      <TaskChips tasks={chemicalTasks} />

      {showMmField ? (
        <div className="mt-3 flex items-center gap-2">
          <label className="shrink-0 text-xs font-bold text-[#374151]">
            {t(mmFieldLabelKey(zoneTask.task_types))}
          </label>
          <input
            type="number"
            min={0}
            step="0.5"
            value={zoneTask.mowing_height_mm}
            onChange={(e) =>
              onUpdate(zoneTask.clientId, { mowing_height_mm: e.target.value })
            }
            className="h-9 w-24 rounded-lg border border-[#E5E7EB] px-2 text-sm outline-none focus:border-[#121820]"
            placeholder="0"
          />
          <span className="text-xs font-semibold text-red-500">mm</span>
        </div>
      ) : null}

      {showFungicide ? (
        <div className="mt-3">
          <p className="mb-2 text-xs font-bold text-[#374151]">
            {t('fungicideTargets')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {FUNGICIDE_TARGETS.map((item) => {
              const checked = zoneTask.fungicide_targets.includes(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleFungicideTarget(item.id)}
                  className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                    checked
                      ? 'border-amber-500 bg-amber-50 text-amber-800'
                      : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-amber-200'
                  }`}
                >
                  {t(item.labelKey)}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {showFertilizer ? (
        <div className="mt-3">
          <p className="mb-2 text-xs font-bold text-[#374151]">
            {t('fertilizerMethod')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {FERTILIZER_MODES.map((mode) => {
              const checked = zoneTask.fertilizer_mode === mode.key
              return (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setFertilizerMode(mode.key)}
                  className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition ${
                    checked
                      ? 'border-sky-600 bg-sky-50 text-sky-800'
                      : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-sky-200'
                  }`}
                >
                  {t(mode.labelKey)}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <p className="mb-1.5 text-xs font-bold text-[#374151]">{t('assignee')}</p>
        <input
          type="text"
          value={zoneTask.assignee_name}
          onChange={(e) =>
            onUpdate(zoneTask.clientId, { assignee_name: e.target.value })
          }
          placeholder={t('assigneePlaceholder')}
          className={inputClass}
        />
      </div>

      <div className="mt-3">
        <input
          type="text"
          value={zoneTask.notes}
          onChange={(e) =>
            onUpdate(zoneTask.clientId, { notes: e.target.value })
          }
          placeholder={t('memoOptional')}
          className={inputClass}
        />
      </div>
    </article>
  )
}
