import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TaskKey, ZoneKey } from '../constants/dailyPlan'

export type LatLngTuple = [number, number]

export type TaskZone = {
  id: string
  courseId: string
  title: string
  zone: ZoneKey
  taskTypes: TaskKey[]
  /** ISO date YYYY-MM-DD */
  workDate: string
  note: string
  /** Closed polygon ring (lat, lng) */
  points: LatLngTuple[]
  createdAt: string
}

type TaskZoneStore = {
  zones: TaskZone[]
  addZone: (
    input: Omit<TaskZone, 'id' | 'createdAt'>,
  ) => TaskZone
  updateZone: (
    id: string,
    patch: Partial<Pick<TaskZone, 'note' | 'title' | 'workDate'>>,
  ) => void
  removeZone: (id: string) => void
  clearCourseZones: (courseId: string) => void
  zonesForCourse: (courseId: string) => TaskZone[]
}

export const TASK_MARK_COLOR = '#1B5E20'

/** Distinct color per maintenance / chemical task (map + chips) */
export const TASK_COLORS: Record<TaskKey, string> = {
  mowing: '#1B5E20',
  rolling: '#1565C0',
  hollow_tine: '#6A1B9A',
  solid_tine: '#4527A0',
  top_dressing: '#E65100',
  slicing: '#00838F',
  verticutting: '#2E7D32',
  verti_drain: '#5D4037',
  overseeding: '#C62828',
  watering: '#0277BD',
  fungicide: '#AD1457',
  insecticide: '#F9A825',
  fertilizing: '#558B2F',
}

/** Color for a mark — picks the most distinctive (non-mowing) task color */
export function colorForTasks(taskTypes: TaskKey[]): string {
  if (taskTypes.length === 0) return TASK_MARK_COLOR
  if (taskTypes.length === 1) return TASK_COLORS[taskTypes[0]] ?? TASK_MARK_COLOR
  const nonMowing = taskTypes.filter((k) => k !== 'mowing')
  const distinctive = nonMowing[nonMowing.length - 1]
  if (distinctive && TASK_COLORS[distinctive]) return TASK_COLORS[distinctive]
  return TASK_COLORS[taskTypes[0]] ?? TASK_MARK_COLOR
}

export const ZONE_COLORS: Record<ZoneKey, string> = {
  green: '#2d5a27',
  tee: '#4a8a42',
  fairway: '#3d9b4a',
  rough: '#78716c',
  bunker: '#c9a84c',
  landscaping: '#0ea5e9',
  other: '#6366f1',
}

export const useTaskZoneStore = create<TaskZoneStore>()(
  persist(
    (set, get) => ({
      zones: [],

      addZone: (input) => {
        const zone: TaskZone = {
          ...input,
          id: crypto.randomUUID(),
          title: input.title.trim(),
          note: input.note.trim(),
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ zones: [zone, ...s.zones] }))
        return zone
      },

      updateZone: (id, patch) => {
        set((s) => ({
          zones: s.zones.map((z) => {
            if (z.id !== id) return z
            return {
              ...z,
              ...patch,
              note:
                patch.note !== undefined ? patch.note.trim() : z.note,
              title:
                patch.title !== undefined ? patch.title.trim() : z.title,
            }
          }),
        }))
      },

      removeZone: (id) => {
        set((s) => ({ zones: s.zones.filter((z) => z.id !== id) }))
      },

      clearCourseZones: (courseId) => {
        set((s) => ({
          zones: s.zones.filter((z) => z.courseId !== courseId),
        }))
      },

      zonesForCourse: (courseId) =>
        get().zones.filter((z) => z.courseId === courseId),
    }),
    { name: 'greencare-task-zones' },
  ),
)
