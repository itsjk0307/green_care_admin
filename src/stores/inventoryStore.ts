import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type InventoryItem = {
  id: string
  courseId: string
  name: string
  unit: string
  quantity: number
  /** Alert when quantity is at or below this (default 1) */
  lowThreshold: number
  note: string
  updatedAt: string
}

type InventoryStore = {
  items: InventoryItem[]
  addItem: (input: {
    courseId: string
    name: string
    unit: string
    quantity: number
    lowThreshold?: number
    note?: string
  }) => InventoryItem
  removeItem: (id: string) => void
  restock: (id: string, amount: number) => InventoryItem | null
  useStock: (id: string, amount: number) => InventoryItem | null
  setLowThreshold: (id: string, threshold: number) => void
  itemsForCourse: (courseId: string) => InventoryItem[]
  lowStockForCourse: (courseId: string) => InventoryItem[]
}

function nowIso() {
  return new Date().toISOString()
}

export function isLowStock(item: InventoryItem) {
  return item.quantity <= item.lowThreshold
}

export const useInventoryStore = create<InventoryStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: ({
        courseId,
        name,
        unit,
        quantity,
        lowThreshold = 1,
        note = '',
      }) => {
        const item: InventoryItem = {
          id: crypto.randomUUID(),
          courseId,
          name: name.trim(),
          unit: unit.trim() || 'ea',
          quantity: Math.max(0, quantity),
          lowThreshold: Math.max(0, lowThreshold),
          note: note.trim(),
          updatedAt: nowIso(),
        }
        set((s) => ({ items: [item, ...s.items] }))
        return item
      },

      removeItem: (id) => {
        set((s) => ({ items: s.items.filter((i) => i.id !== id) }))
      },

      restock: (id, amount) => {
        if (amount <= 0) return null
        let updated: InventoryItem | null = null
        set((s) => ({
          items: s.items.map((item) => {
            if (item.id !== id) return item
            updated = {
              ...item,
              quantity: item.quantity + amount,
              updatedAt: nowIso(),
            }
            return updated
          }),
        }))
        return updated
      },

      useStock: (id, amount) => {
        if (amount <= 0) return null
        let updated: InventoryItem | null = null
        set((s) => ({
          items: s.items.map((item) => {
            if (item.id !== id) return item
            updated = {
              ...item,
              quantity: Math.max(0, item.quantity - amount),
              updatedAt: nowIso(),
            }
            return updated
          }),
        }))
        return updated
      },

      setLowThreshold: (id, threshold) => {
        set((s) => ({
          items: s.items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  lowThreshold: Math.max(0, threshold),
                  updatedAt: nowIso(),
                }
              : item,
          ),
        }))
      },

      itemsForCourse: (courseId) =>
        get().items.filter((i) => i.courseId === courseId),

      lowStockForCourse: (courseId) =>
        get()
          .items.filter((i) => i.courseId === courseId)
          .filter(isLowStock),
    }),
    {
      name: 'greencare-inventory',
      version: 2,
      migrate: (persisted) => {
        const state = persisted as { items?: Array<Partial<InventoryItem>> }
        const items = (state.items ?? []).map((item) => ({
          id: item.id ?? crypto.randomUUID(),
          courseId: item.courseId ?? '',
          name: item.name ?? '',
          unit: item.unit ?? 'ea',
          quantity: Number(item.quantity) || 0,
          lowThreshold:
            item.lowThreshold != null ? Number(item.lowThreshold) : 1,
          note: item.note ?? '',
          updatedAt: item.updatedAt ?? nowIso(),
        }))
        return { items }
      },
    },
  ),
)
