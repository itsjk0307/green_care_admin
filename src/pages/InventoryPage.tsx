import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArchiveBoxIcon,
  ExclamationTriangleIcon,
  MinusIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { fetchCourses } from '../api/courses'
import { AiThinkingIndicator } from '../components/ai/AiThinkingIndicator'
import { AiSparkleIcon } from '../components/icons/AiSparkleIcon'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { courseDisplayName } from '../lib/courseName'
import {
  askInventoryAi,
  lowStockBriefingPrompt,
  type InventoryAiChatMessage,
  type RestockSuggestion,
} from '../lib/inventoryAi'
import {
  isLowStock,
  useInventoryStore,
  type InventoryItem,
} from '../stores/inventoryStore'
import { useLanguageStore } from '../stores/languageStore'

const COURSE_STORAGE_KEY = 'greencare-inventory-course-id'

const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#121820] focus:ring-2 focus:ring-[#121820]/15'

export function InventoryPage() {
  const { t, language } = useLanguageStore()
  const allItems = useInventoryStore((s) => s.items)
  const addItem = useInventoryStore((s) => s.addItem)
  const removeItem = useInventoryStore((s) => s.removeItem)
  const restock = useInventoryStore((s) => s.restock)
  const useStock = useInventoryStore((s) => s.useStock)

  const [courseId, setCourseId] = useState(
    () => localStorage.getItem(COURSE_STORAGE_KEY) ?? '',
  )
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('ea')
  const [quantity, setQuantity] = useState('1')
  const [lowThreshold, setLowThreshold] = useState('1')
  const [note, setNote] = useState('')
  const [adjustBy, setAdjustBy] = useState<Record<string, string>>({})

  const [aiInput, setAiInput] = useState('')
  const [aiMessages, setAiMessages] = useState<InventoryAiChatMessage[]>([])
  const [aiSuggestions, setAiSuggestions] = useState<RestockSuggestion[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [briefingDismissed, setBriefingDismissed] = useState(false)
  const briefingStartedFor = useRef<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const coursesQuery = useQuery({ queryKey: ['courses'], queryFn: fetchCourses })
  const courses = coursesQuery.data ?? []

  useEffect(() => {
    if (courseId) localStorage.setItem(COURSE_STORAGE_KEY, courseId)
  }, [courseId])

  useEffect(() => {
    if (!courseId && courses.length === 1) {
      setCourseId(courses[0].id)
    }
  }, [courseId, courses])

  const items = useMemo(
    () =>
      courseId
        ? allItems.filter((i) => i.courseId === courseId)
        : [],
    [allItems, courseId],
  )
  const lowItems = useMemo(() => items.filter(isLowStock), [items])
  const selectedCourse = courses.find((c) => c.id === courseId)
  const courseName = selectedCourse
    ? courseDisplayName(selectedCourse, language)
    : ''

  useEffect(() => {
    setAiMessages([])
    setAiSuggestions([])
    setAiInput('')
    setBriefingDismissed(false)
    briefingStartedFor.current = null
  }, [courseId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages, aiLoading])

  async function runAiAsk(question: string, baseHistory = aiMessages) {
    const q = question.trim()
    if (!q || !courseId || aiLoading) return

    const userMsg: InventoryAiChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: q,
    }
    const nextHistory = [...baseHistory, userMsg]
    setAiMessages(nextHistory)
    setAiInput('')
    setAiLoading(true)

    try {
      const result = await askInventoryAi({
        question: q,
        items,
        courseName: courseName || t('course'),
        language,
        history: baseHistory,
      })
      setAiMessages([
        ...nextHistory,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: result.displayText,
        },
      ])
      if (result.suggestions.length > 0) {
        setAiSuggestions(result.suggestions)
      }
    } catch {
      toast.error(t('inventoryAiError'), { className: 'gc-toast-error' })
      setAiMessages(baseHistory)
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    if (!courseId || briefingDismissed || aiLoading) return
    if (lowItems.length === 0) return
    if (briefingStartedFor.current === courseId) return
    briefingStartedFor.current = courseId
    void runAiAsk(lowStockBriefingPrompt(language), [])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per course visit when low stock
  }, [courseId, lowItems.length, briefingDismissed])

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!courseId) {
      toast.error(t('inventorySelectCourseFirst'), {
        className: 'gc-toast-error',
      })
      return
    }
    if (!name.trim()) {
      toast.error(t('inventoryNameRequired'), { className: 'gc-toast-error' })
      return
    }
    const qty = Number(quantity)
    const thr = Number(lowThreshold)
    if (!Number.isFinite(qty) || qty < 0) {
      toast.error(t('inventoryInvalidQty'), { className: 'gc-toast-error' })
      return
    }
    const item = addItem({
      courseId,
      name,
      unit: unit || 'ea',
      quantity: qty,
      lowThreshold: Number.isFinite(thr) ? thr : 1,
      note,
    })
    setName('')
    setQuantity('1')
    setNote('')
    toast.success(t('inventoryAdded'), { className: 'gc-toast-success' })
    if (isLowStock(item)) {
      toast.error(
        t('inventoryLowAlert', { name: item.name, qty: item.quantity }),
        { className: 'gc-toast-error', duration: 5000 },
      )
    }
  }

  function amountFor(id: string) {
    const n = Number(adjustBy[id] ?? '1')
    return Number.isFinite(n) && n > 0 ? n : 1
  }

  function onRestock(item: InventoryItem) {
    const updated = restock(item.id, amountFor(item.id))
    if (!updated) return
    toast.success(
      t('inventoryRestocked', {
        name: updated.name,
        qty: updated.quantity,
        unit: updated.unit,
      }),
      { className: 'gc-toast-success' },
    )
  }

  function onUse(item: InventoryItem) {
    const amt = amountFor(item.id)
    if (amt > item.quantity) {
      toast.error(t('inventoryNotEnough'), { className: 'gc-toast-error' })
      return
    }
    const wasLow = isLowStock(item)
    const updated = useStock(item.id, amt)
    if (!updated) return
    toast.success(
      t('inventoryUsed', {
        name: updated.name,
        used: amt,
        qty: updated.quantity,
        unit: updated.unit,
      }),
      { className: 'gc-toast-success' },
    )
    if (
      isLowStock(updated) &&
      (!wasLow || updated.quantity <= updated.lowThreshold)
    ) {
      toast.error(
        t('inventoryLowAlert', {
          name: updated.name,
          qty: updated.quantity,
        }),
        { className: 'gc-toast-error', duration: 6000 },
      )
    }
  }

  function applySuggestion(s: RestockSuggestion) {
    const updated = restock(s.itemId, s.qty)
    if (!updated) return
    setAiSuggestions((prev) => prev.filter((x) => x.itemId !== s.itemId))
    toast.success(
      t('inventoryAiApplied', {
        name: s.itemName,
        qty: s.qty,
        unit: s.unit,
      }),
      { className: 'gc-toast-success' },
    )
  }

  function handleAiSubmit(e: FormEvent) {
    e.preventDefault()
    void runAiAsk(aiInput)
  }

  const promptChips = [
    { key: 'low' as const, label: t('inventoryAiPromptLow') },
    { key: 'reorder' as const, label: t('inventoryAiPromptReorder') },
    { key: 'fungicide' as const, label: t('inventoryAiPromptFungicide') },
  ]

  if (coursesQuery.isLoading) {
    return <LoadingSpinner message={t('loadingCourses')} />
  }

  return (
    <div className="page-enter mx-auto max-w-6xl space-y-4 pb-8 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            {t('inventory')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t('inventoryHint')}</p>
        </div>
        <div className="w-full min-w-0 sm:max-w-xs">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {t('course')}
          </label>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              {t('selectCourse')}
            </option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {courseDisplayName(c, language)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!courseId ? (
        <EmptyState
          icon={<ArchiveBoxIcon className="h-10 w-10 text-slate-300" />}
          title={t('inventorySelectCourseFirst')}
          description={t('inventorySelectCourseHint')}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
          <div className="space-y-4 sm:space-y-5">
            {selectedCourse ? (
              <p className="text-sm font-medium text-[#121820]">
                {t('inventoryForCourse', {
                  course: courseDisplayName(selectedCourse, language),
                })}
              </p>
            ) : null}

            {lowItems.length > 0 ? (
              <div
                role="alert"
                className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900"
              >
                <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p className="font-semibold">{t('inventoryLowBannerTitle')}</p>
                  <ul className="mt-1.5 space-y-0.5 text-[13px]">
                    {lowItems.map((item) => (
                      <li key={item.id}>
                        {t('inventoryLowBannerItem', {
                          name: item.name,
                          qty: item.quantity,
                          unit: item.unit,
                        })}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-sm font-semibold text-slate-900">
                {t('inventoryAddTitle')}
              </h2>
              <form
                onSubmit={handleAdd}
                className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6"
              >
                <div className="lg:col-span-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {t('inventoryItemName')}
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    placeholder={t('inventoryItemNamePh')}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {t('inventoryUnit')}
                  </label>
                  <input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className={inputClass}
                    placeholder="L / kg / ea"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {t('inventoryQty')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {t('inventoryLowAt')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={lowThreshold}
                    onChange={(e) => setLowThreshold(e.target.value)}
                    className={inputClass}
                    title={t('inventoryLowAtHint')}
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full">
                    {t('inventoryAddBtn')}
                  </Button>
                </div>
                <div className="sm:col-span-2 lg:col-span-6">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {t('inventoryNote')}
                  </label>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className={inputClass}
                    placeholder={t('inventoryNotePh')}
                  />
                </div>
              </form>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900">
                  {t('inventoryListTitle')}
                </h2>
                <span className="text-xs text-slate-400">
                  {t('inventoryCount', { count: items.length })}
                </span>
              </div>

              {items.length === 0 ? (
                <EmptyState
                  icon={<ArchiveBoxIcon className="h-10 w-10 text-slate-300" />}
                  title={t('inventoryEmpty')}
                  description={t('inventoryEmptyHint')}
                />
              ) : (
                <ul className="space-y-3">
                  {items.map((item) => {
                    const low = isLowStock(item)
                    return (
                      <li
                        key={item.id}
                        className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${
                          low
                            ? 'border-amber-300 ring-1 ring-amber-200'
                            : 'border-slate-100'
                        }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-[15px] font-semibold text-slate-900">
                                {item.name}
                              </p>
                              {low ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                  {t('inventoryLowBadge')}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-slate-500">
                              <span className="font-semibold text-slate-800">
                                {item.quantity}
                              </span>{' '}
                              {item.unit}
                              <span className="mx-1.5 text-slate-300">·</span>
                              {t('inventoryAlertWhen', {
                                n: item.lowThreshold,
                                unit: item.unit,
                              })}
                            </p>
                            {item.note ? (
                              <p className="mt-1 text-xs text-slate-400">
                                {item.note}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="number"
                              min={0.1}
                              step="any"
                              value={adjustBy[item.id] ?? '1'}
                              onChange={(e) =>
                                setAdjustBy((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-sm outline-none focus:border-[#121820]"
                              aria-label={t('inventoryAdjustAmount')}
                            />
                            <button
                              type="button"
                              onClick={() => onRestock(item)}
                              className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <PlusIcon className="h-4 w-4" />
                              {t('inventoryRestock')}
                            </button>
                            <button
                              type="button"
                              onClick={() => onUse(item)}
                              className="inline-flex h-9 items-center gap-1 rounded-xl bg-[#121820] px-3 text-xs font-medium text-white hover:bg-[#1c2630]"
                            >
                              <MinusIcon className="h-4 w-4" />
                              {t('inventoryUse')}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                removeItem(item.id)
                                toast.success(t('inventoryRemoved'), {
                                  className: 'gc-toast-success',
                                })
                              }}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-red-500 hover:bg-red-50"
                              aria-label={t('inventoryRemove')}
                              title={t('inventoryRemove')}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>

          <aside className="lg:sticky lg:top-4">
            <section className="flex h-[min(70vh,560px)] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <AiSparkleIcon className="h-5 w-5 text-[#121820]" />
                    <h2 className="text-sm font-semibold text-slate-900">
                      {t('inventoryAiTitle')}
                    </h2>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t('inventoryAiHint')}
                  </p>
                </div>
                {aiMessages.length > 0 || aiSuggestions.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setBriefingDismissed(true)
                      setAiMessages([])
                      setAiSuggestions([])
                    }}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                    aria-label={t('inventoryAiDismissBriefing')}
                    title={t('inventoryAiDismissBriefing')}
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1.5 border-b border-slate-50 px-3 py-2.5">
                {promptChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    disabled={aiLoading}
                    onClick={() => void runAiAsk(chip.label)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-[#121820]/30 hover:bg-white disabled:opacity-50"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
                {aiMessages.length === 0 && !aiLoading ? (
                  <p className="px-1 py-6 text-center text-xs text-slate-400">
                    {t('inventoryAiEmpty')}
                  </p>
                ) : null}
                {aiMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
                        m.role === 'user'
                          ? 'bg-[#121820] text-white'
                          : 'bg-slate-50 text-slate-800'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {aiLoading ? (
                  <div className="rounded-2xl bg-slate-50 px-3 py-2">
                    <AiThinkingIndicator mode="thinking" t={t} />
                  </div>
                ) : null}
                <div ref={chatEndRef} />
              </div>

              {aiSuggestions.length > 0 ? (
                <div className="border-t border-slate-100 px-3 py-2.5">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {t('inventoryAiSuggestionsTitle')}
                  </p>
                  <ul className="space-y-1.5">
                    {aiSuggestions.map((s) => (
                      <li
                        key={s.itemId}
                        className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-2.5 py-2"
                      >
                        <span className="min-w-0 truncate text-xs font-medium text-slate-800">
                          {s.itemName}
                        </span>
                        <button
                          type="button"
                          onClick={() => applySuggestion(s)}
                          className="shrink-0 rounded-lg bg-[#121820] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#1c2630]"
                        >
                          {t('inventoryAiApply', {
                            qty: s.qty,
                            unit: s.unit,
                          })}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <form
                onSubmit={handleAiSubmit}
                className="flex gap-2 border-t border-slate-100 p-3"
              >
                <input
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  disabled={aiLoading}
                  className={inputClass}
                  placeholder={t('inventoryAiPlaceholder')}
                />
                <Button
                  type="submit"
                  disabled={aiLoading || !aiInput.trim()}
                  className="shrink-0"
                >
                  {t('inventoryAiAsk')}
                </Button>
              </form>
            </section>
          </aside>
        </div>
      )}
    </div>
  )
}
