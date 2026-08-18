import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CircleMarker,
  Pane,
  Polygon,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import toast from 'react-hot-toast'
import {
  TASK_TYPES,
  todayLocalDate,
  type TaskKey,
} from '../../constants/dailyPlan'
import {
  TASK_COLORS,
  colorForTasks,
  useTaskZoneStore,
  type LatLngTuple,
  type TaskZone,
} from '../../stores/taskZoneStore'
import { useLanguageStore } from '../../stores/languageStore'
import { useIsMobile } from '../../hooks/useBreakpoint'

type Props = {
  courseId: string
  onSaved: () => void
}

type PickState = {
  taskTypes: TaskKey[]
  workDate: string
  note: string
}

const workTasks = TASK_TYPES.filter((t) => t.group === 'work')
const chemicalTasks = TASK_TYPES.filter((t) => t.group === 'chemical')

function taskLabels(
  keys: TaskKey[],
  t: (key: (typeof TASK_TYPES)[number]['labelKey']) => string,
) {
  return keys
    .map((key) => {
      const found = TASK_TYPES.find((x) => x.key === key)
      return found ? t(found.labelKey) : key
    })
    .join(', ')
}

function DrawClicks({
  enabled,
  onPoint,
}: {
  enabled: boolean
  onPoint: (pt: LatLngTuple) => void
}) {
  useMapEvents({
    click(e) {
      if (!enabled) return
      onPoint([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}

function DrawCursor({ enabled }: { enabled: boolean }) {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    el.style.cursor = enabled ? 'crosshair' : ''
    return () => {
      el.style.cursor = ''
    }
  }, [enabled, map])
  return null
}

function MarkPopup({
  zone,
  onDelete,
  onSaveNote,
}: {
  zone: TaskZone
  onDelete: (id: string) => void
  onSaveNote: (id: string, note: string) => void
}) {
  const { t } = useLanguageStore()
  const color = colorForTasks(zone.taskTypes)
  const [noteDraft, setNoteDraft] = useState(zone.note ?? '')

  useEffect(() => {
    setNoteDraft(zone.note ?? '')
  }, [zone.id, zone.note])

  const tasks = zone.taskTypes
    .map((key) => {
      const found = TASK_TYPES.find((x) => x.key === key)
      return found
        ? { key, label: t(found.labelKey), color: TASK_COLORS[key] }
        : null
    })
    .filter(Boolean) as { key: string; label: string; color: string }[]

  return (
    <Popup
      className="task-mark-popup"
      closeButton
      maxWidth={260}
      minWidth={220}
    >
      <div className="task-mark-card">
        <div
          className="task-mark-accent"
          style={{ background: color }}
          aria-hidden
        />
        <div className="task-mark-body">
          <div className="task-mark-chips">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <span
                  key={task.key}
                  className="task-mark-chip"
                  style={{
                    borderColor: `${task.color}55`,
                    background: `${task.color}14`,
                    color: task.color,
                  }}
                >
                  <span
                    className="task-mark-chip-dot"
                    style={{ background: task.color }}
                  />
                  {task.label}
                </span>
              ))
            ) : (
              <span className="task-mark-title">{t('taskZones')}</span>
            )}
          </div>

          <p className="task-mark-date">
            <span className="task-mark-date-label">{t('taskZoneWorkDate')}</span>
            {zone.workDate}
          </p>

          <label className="task-mark-note-label" htmlFor={`note-${zone.id}`}>
            {t('memoOptional')}
          </label>
          <textarea
            id={`note-${zone.id}`}
            className="task-mark-note-input"
            rows={2}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder={t('taskMarkNotePh')}
          />
          <button
            type="button"
            className="task-mark-save-note"
            onClick={() => onSaveNote(zone.id, noteDraft)}
          >
            {t('taskZoneSave')}
          </button>

          <button
            type="button"
            className="task-mark-delete"
            onClick={() => onDelete(zone.id)}
          >
            {t('taskZoneDelete')}
          </button>
        </div>
      </div>
    </Popup>
  )
}

/** One colored pin — enough for a whole fairway / hole area */
function TaskPin({
  zone,
  onDelete,
  onSaveNote,
}: {
  zone: TaskZone
  onDelete: (id: string) => void
  onSaveNote: (id: string, note: string) => void
}) {
  const color = colorForTasks(zone.taskTypes)
  const center = zone.points[0]
  if (!center) return null

  return (
    <CircleMarker
      center={center}
      radius={11}
      pathOptions={{
        color: '#fff',
        weight: 3,
        fillColor: color,
        fillOpacity: 1,
      }}
    >
      <MarkPopup zone={zone} onDelete={onDelete} onSaveNote={onSaveNote} />
    </CircleMarker>
  )
}

/** Older polygon marks (3+ points) — still shown if already saved */
function ZonePolygon({
  zone,
  onDelete,
  onSaveNote,
}: {
  zone: TaskZone
  onDelete: (id: string) => void
  onSaveNote: (id: string, note: string) => void
}) {
  const color = colorForTasks(zone.taskTypes)
  return (
    <Polygon
      positions={zone.points}
      pathOptions={{
        color,
        weight: 2.5,
        fillColor: color,
        fillOpacity: 0.28,
      }}
    >
      <MarkPopup zone={zone} onDelete={onDelete} onSaveNote={onSaveNote} />
    </Polygon>
  )
}

function TaskMark({
  zone,
  onDelete,
  onSaveNote,
}: {
  zone: TaskZone
  onDelete: (id: string) => void
  onSaveNote: (id: string, note: string) => void
}) {
  if (zone.points.length >= 3) {
    return (
      <ZonePolygon zone={zone} onDelete={onDelete} onSaveNote={onSaveNote} />
    )
  }
  return <TaskPin zone={zone} onDelete={onDelete} onSaveNote={onSaveNote} />
}

function ChipButton({
  label,
  color,
  on,
  onClick,
  compact,
}: {
  label: string
  color: string
  on: boolean
  onClick: () => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        compact
          ? 'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[12px] font-semibold'
          : 'flex min-h-[44px] w-full items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-left text-[14px] font-semibold transition'
      }
      style={{
        borderColor: on ? color : '#E5E7EB',
        background: on ? `${color}18` : '#fff',
        color: on ? color : '#4B5563',
      }}
    >
      <span
        className={`shrink-0 rounded-full border border-black/10 ${compact ? 'h-2 w-2' : 'h-3 w-3'}`}
        style={{ background: color }}
        aria-hidden
      />
      {label}
    </button>
  )
}

type FloatingTab = 'work' | 'chemical' | 'memo' | null

const BRAND_DARK = '#121820'

function ToolbarIcon({ children, active, badge, onClick, title, label }: {
  children: React.ReactNode
  active: boolean
  badge?: number
  onClick: () => void
  title: string
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="group relative flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-2xl transition-all"
      style={{
        background: active ? BRAND_DARK : 'white',
        color: active ? 'white' : '#374151',
      }}
    >
      {children}
      <span className="text-[9px] font-semibold leading-none">{label}</span>
      {badge != null && badge > 0 && (
        <span
          className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-bold text-white"
          style={{ background: BRAND_DARK }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

function TaskMarkPanel({
  pick,
  onToggleTask,
  onNoteChange,
  onClear,
  lastMarkId,
  onUndoLast,
}: {
  pick: PickState
  onToggleTask: (key: TaskKey) => void
  onNoteChange: (note: string) => void
  onClear: () => void
  lastMarkId: string | null
  onUndoLast: () => void
}) {
  const { t } = useLanguageStore()
  const isMobile = useIsMobile()
  const ready = pick.taskTypes.length > 0
  const accent = ready ? colorForTasks(pick.taskTypes) : undefined
  const stepHint = ready ? t('taskMarkStep2') : t('taskMarkStep1')
  const [sheetOpen, setSheetOpen] = useState(true)
  const [openTab, setOpenTab] = useState<FloatingTab>(null)

  const selectedSummary =
    pick.taskTypes.length === 0
      ? null
      : pick.taskTypes
          .slice(0, 2)
          .map((key) => {
            const meta = TASK_TYPES.find((x) => x.key === key)
            return meta ? t(meta.labelKey) : key
          })
          .join(', ') + (pick.taskTypes.length > 2 ? '…' : '')

  function handleToggleTask(key: TaskKey) {
    const willSelect = !pick.taskTypes.includes(key)
    onToggleTask(key)
    if (isMobile && willSelect) setSheetOpen(false)
  }

  function handleClear() {
    onClear()
    if (isMobile) setSheetOpen(true)
    setOpenTab(null)
  }

  const workCount = pick.taskTypes.filter((k) => workTasks.some((t) => t.key === k)).length
  const chemCount = pick.taskTypes.filter((k) => chemicalTasks.some((t) => t.key === k)).length

  // ── Mobile: keep the existing bottom sheet ──
  if (isMobile) {
    const taskLists = (
      <>
        <div>
          <p className="mb-1.5 text-[11px] font-bold text-[#374151]">{t('workItems')}</p>
          <div className="flex flex-wrap gap-1.5">
            {workTasks.map((task) => (
              <ChipButton key={task.key} label={t(task.labelKey)} color={TASK_COLORS[task.key]} on={pick.taskTypes.includes(task.key)} compact onClick={() => handleToggleTask(task.key)} />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-bold text-[#374151]">{t('chemicals')}</p>
          <div className="flex flex-wrap gap-1.5">
            {chemicalTasks.map((task) => (
              <ChipButton key={task.key} label={t(task.labelKey)} color={TASK_COLORS[task.key]} on={pick.taskTypes.includes(task.key)} compact onClick={() => handleToggleTask(task.key)} />
            ))}
          </div>
        </div>
      </>
    )

    return (
      <div data-pdf-hide className="pointer-events-none absolute inset-x-0 bottom-0 z-[1200]">
        <div className="pointer-events-auto rounded-t-2xl border border-b-0 border-slate-200 bg-white shadow-[0_-8px_30px_rgba(15,23,42,0.14)]">
          <button type="button" onClick={() => setSheetOpen((v) => !v)} className="flex w-full flex-col items-center px-3 pb-2 pt-2" style={{ borderTop: `3px solid ${accent ?? 'transparent'}` }}>
            <span className="mb-2 h-1 w-10 rounded-full bg-slate-300" />
            <div className="flex w-full items-center gap-2 text-left">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-slate-900">{t('taskMarkTitle')}</p>
                <p className={`truncate text-[11px] font-medium ${ready ? 'text-[#166534]' : 'text-slate-500'}`}>
                  {ready && !sheetOpen ? `${selectedSummary} · ${t('taskMarkStep2')}` : stepHint}
                </p>
              </div>
              <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600">
                {sheetOpen ? t('taskSheetHide') : t('taskSheetShow')}
              </span>
            </div>
          </button>
          {sheetOpen ? <div className="max-h-[min(48vh,320px)] space-y-3 overflow-y-auto border-t border-slate-100 px-3 py-2.5">{taskLists}</div> : null}
          <div className="border-t border-slate-100 px-3 py-2">
            <label htmlFor="task-mark-note-mobile" className="mb-1 block text-[11px] font-bold text-[#374151]">{t('memoOptional')}</label>
            <textarea id="task-mark-note-mobile" value={pick.note} onChange={(e) => onNoteChange(e.target.value)} onPointerDown={(e) => e.stopPropagation()} placeholder={t('taskMarkNotePh')} rows={2} className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#121820] focus:ring-1 focus:ring-[#121820]" />
          </div>
          <div className="border-t border-slate-100 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="flex gap-1.5">
              <button type="button" disabled={!lastMarkId} onClick={onUndoLast} className="h-9 flex-1 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 disabled:opacity-35 hover:bg-slate-50">{t('taskZoneUndo')}</button>
              <button type="button" disabled={pick.taskTypes.length === 0} onClick={handleClear} className="h-9 flex-1 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 disabled:opacity-35 hover:bg-slate-50">{t('taskMarkClear')}</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Desktop: floating toolbar with expandable panels ──
  const toggleTab = (tab: FloatingTab) => setOpenTab((prev) => prev === tab ? null : tab)

  return (
    <div data-pdf-hide className="pointer-events-none absolute right-3 top-1/2 z-[1200] flex -translate-y-1/2 items-start gap-2.5">
      {/* Expanded panel */}
      {openTab && (
        <div className="pointer-events-auto w-[250px] animate-in fade-in slide-in-from-right-2 duration-150 rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-slate-900">
                {openTab === 'work' ? t('workItems') : openTab === 'chemical' ? t('chemicals') : t('memoOptional')}
              </p>
              {openTab !== 'memo' && (
                <p className="mt-0.5 text-[11px] text-slate-400">{stepHint}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpenTab(null)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              title={t('taskSheetHide')}
              aria-label={t('taskSheetHide')}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {openTab === 'work' && (
            <div className="max-h-[420px] space-y-1.5 overflow-y-auto px-3 py-2.5">
              {workTasks.map((task) => (
                <ChipButton key={task.key} label={t(task.labelKey)} color={TASK_COLORS[task.key]} on={pick.taskTypes.includes(task.key)} onClick={() => handleToggleTask(task.key)} />
              ))}
            </div>
          )}

          {openTab === 'chemical' && (
            <div className="max-h-[420px] space-y-1.5 overflow-y-auto px-3 py-2.5">
              {chemicalTasks.map((task) => (
                <ChipButton key={task.key} label={t(task.labelKey)} color={TASK_COLORS[task.key]} on={pick.taskTypes.includes(task.key)} onClick={() => handleToggleTask(task.key)} />
              ))}
            </div>
          )}

          {openTab === 'memo' && (
            <div className="px-3 py-2.5">
              <textarea
                value={pick.note}
                onChange={(e) => onNoteChange(e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
                placeholder={t('taskMarkNotePh')}
                rows={4}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#121820] focus:ring-1 focus:ring-[#121820]"
              />
            </div>
          )}

          <div className="space-y-2 border-t border-slate-100 px-3 py-2.5">
            <button
              type="button"
              onClick={() => setOpenTab(null)}
              className="h-11 w-full rounded-xl bg-[#121820] text-[14px] font-semibold text-white transition hover:bg-[#1c2630]"
            >
              {t('taskZoneFinish')}
            </button>
            <div className="flex gap-2">
              <button type="button" disabled={!lastMarkId} onClick={onUndoLast} className="h-10 flex-1 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 disabled:opacity-35 hover:bg-slate-50">
                {t('taskZoneUndo')}
              </button>
              <button type="button" disabled={pick.taskTypes.length === 0} onClick={handleClear} className="h-10 flex-1 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 disabled:opacity-35 hover:bg-slate-50">
                {t('taskMarkClear')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Icon toolbar */}
      <div className="pointer-events-auto flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
        <ToolbarIcon active={openTab === 'work'} badge={workCount} onClick={() => toggleTab('work')} title={t('workItems')} label={t('workItems')}>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
        </ToolbarIcon>

        <ToolbarIcon active={openTab === 'chemical'} badge={chemCount} onClick={() => toggleTab('chemical')} title={t('chemicals')} label={t('chemicals')}>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 5.607A1.125 1.125 0 0120.108 22H3.893a1.125 1.125 0 01-1.094-1.093L4.2 15.3" />
          </svg>
        </ToolbarIcon>

        <ToolbarIcon active={openTab === 'memo'} badge={pick.note.trim() ? 1 : 0} onClick={() => toggleTab('memo')} title={t('memoOptional')} label={t('memoOptional').replace(/\s*\(.*\)/, '')}>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
        </ToolbarIcon>

        <div className="mx-1.5 h-px bg-slate-200" />

        <ToolbarIcon active={false} onClick={onUndoLast} title={t('taskZoneUndo')} label={t('taskZoneUndo')}>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ opacity: lastMarkId ? 1 : 0.3 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
        </ToolbarIcon>

        <ToolbarIcon active={false} onClick={handleClear} title={t('taskMarkClear')} label={t('taskMarkClear')}>
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ opacity: pick.taskTypes.length > 0 ? 1 : 0.3 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </ToolbarIcon>
      </div>
    </div>
  )
}

export function TaskZonesLayer({ courseId, onSaved }: Props) {
  const map = useMap()
  const { t } = useLanguageStore()
  const zones = useTaskZoneStore((s) => s.zones)
  const addZone = useTaskZoneStore((s) => s.addZone)
  const updateZone = useTaskZoneStore((s) => s.updateZone)
  const removeZone = useTaskZoneStore((s) => s.removeZone)
  const courseZones = useMemo(
    () => zones.filter((z) => z.courseId === courseId),
    [zones, courseId],
  )

  const [pick, setPick] = useState<PickState>({
    taskTypes: [],
    workDate: todayLocalDate(),
    note: '',
  })
  const [lastMarkId, setLastMarkId] = useState<string | null>(null)
  const [activeCourseId, setActiveCourseId] = useState(courseId)

  // Reset selection when course changes (supported React pattern — no effect)
  if (courseId !== activeCourseId) {
    setActiveCourseId(courseId)
    setPick({
      taskTypes: [],
      workDate: todayLocalDate(),
      note: '',
    })
    setLastMarkId(null)
  }

  const host = map.getContainer().parentElement
  const canDraw = pick.taskTypes.length > 0

  function placeMark(pt: LatLngTuple) {
    if (pick.taskTypes.length === 0) {
      toast.error(t('taskZoneNeedTasks'), { className: 'gc-toast-error' })
      return
    }

    const title = taskLabels(pick.taskTypes, t)
    const saved = addZone({
      courseId,
      title,
      zone: 'other',
      taskTypes: pick.taskTypes,
      workDate: pick.workDate || todayLocalDate(),
      note: pick.note.trim(),
      points: [pt],
    })
    setLastMarkId(saved.id)
    onSaved()
  }

  const panel =
    host != null
      ? createPortal(
          <TaskMarkPanel
            pick={pick}
            onToggleTask={(key) =>
              setPick((p) => ({
                ...p,
                // Single-select: picking a new task replaces the previous one
                taskTypes: p.taskTypes.includes(key) ? [] : [key],
              }))
            }
            onNoteChange={(note) => setPick((p) => ({ ...p, note }))}
            onClear={() =>
              setPick({
                taskTypes: [],
                workDate: todayLocalDate(),
                note: '',
              })
            }
            lastMarkId={lastMarkId}
            onUndoLast={() => {
              if (!lastMarkId) return
              removeZone(lastMarkId)
              setLastMarkId(null)
            }}
          />,
          host,
        )
      : null

  return (
    <>
      <DrawCursor enabled={canDraw} />
      <DrawClicks enabled={canDraw} onPoint={placeMark} />

      <Pane name="task-zones" style={{ zIndex: 620 }}>
        {courseZones.map((z) => (
          <TaskMark
            key={z.id}
            zone={z}
            onDelete={removeZone}
            onSaveNote={(id, note) => {
              updateZone(id, { note })
              toast.success(t('taskZoneSaved'), { className: 'gc-toast-success' })
            }}
          />
        ))}
      </Pane>

      {panel}
    </>
  )
}
