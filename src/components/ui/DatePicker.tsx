import { useEffect, useRef, useState } from 'react'
import { useLanguageStore } from '../../stores/languageStore'

const BRAND = '#121820'
const BRAND_LIGHT = '#1e2a36'

type Props = {
  value: string
  onChange: (iso: string) => void
  label?: string
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y!, m! - 1, d)
}

const WEEKDAYS_EN = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
const WEEKDAYS_KO = ['월', '화', '수', '목', '금', '토', '일']

function getMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  let startDay = first.getDay() - 1
  if (startDay < 0) startDay = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDays = new Date(year, month, 0).getDate()

  const cells: { day: number; current: boolean; date: Date }[] = []
  for (let i = startDay - 1; i >= 0; i--) {
    const d = prevDays - i
    cells.push({ day: d, current: false, date: new Date(year, month - 1, d) })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true, date: new Date(year, month, d) })
  }
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, current: false, date: new Date(year, month + 1, d) })
  }
  return cells
}

export function DatePicker({ value, onChange, label }: Props) {
  const { language } = useLanguageStore()
  const [open, setOpen] = useState(false)
  const parsed = value ? parseIso(value) : new Date()
  const [viewYear, setViewYear] = useState(parsed.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed.getMonth())
  const [selected, setSelected] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const p = value ? parseIso(value) : new Date()
    setViewYear(p.getFullYear())
    setViewMonth(p.getMonth())
    setSelected(value)
  }, [open, value])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const cells = getMonthGrid(viewYear, viewMonth)
  const weekdays = language === 'ko' ? WEEKDAYS_KO : WEEKDAYS_EN
  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString(
    language === 'ko' ? 'ko-KR' : 'en-US',
    { year: 'numeric', month: 'long' },
  )
  const todayIso = toIso(new Date())
  const isKo = language === 'ko'

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11) }
    else setViewMonth((m) => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0) }
    else setViewMonth((m) => m + 1)
  }
  function handleApply() {
    if (selected) onChange(selected)
    setOpen(false)
  }
  function handleToday() {
    const t = toIso(new Date())
    setSelected(t)
    onChange(t)
    setOpen(false)
  }

  const displayValue = value
    ? parseIso(value).toLocaleDateString(isKo ? 'ko-KR' : 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    : ''

  return (
    <div ref={ref} className="relative min-w-0">
      {label && (
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-900 outline-none transition-all duration-150 hover:border-slate-300 focus:border-[#121820] focus:ring-2 focus:ring-[#121820]/20"
      >
        <span className="flex-1 truncate">{displayValue || '—'}</span>
        <svg className="ml-2 h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-[320px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {isKo ? '날짜 선택' : 'SELECT DATE'}
          </p>
          <div className="mt-1 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">{monthLabel}</h3>
            <div className="flex gap-1">
              <button type="button" onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button type="button" onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-y-0.5 text-center text-[11px] font-semibold text-slate-400">
            {weekdays.map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-y-0.5 text-center text-sm">
            {cells.map((cell, i) => {
              const iso = toIso(cell.date)
              const isSelected = iso === selected
              const isToday = iso === todayIso
              const dimmed = !cell.current
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelected(iso)}
                  className={`mx-auto flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-medium transition-all ${
                    isSelected
                      ? 'text-white shadow-sm'
                      : isToday
                        ? 'font-bold'
                        : dimmed
                          ? 'text-slate-300'
                          : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  style={
                    isSelected
                      ? { backgroundColor: BRAND }
                      : isToday && !isSelected
                        ? { border: `2px solid ${BRAND_LIGHT}`, color: BRAND }
                        : undefined
                  }
                >
                  {cell.day}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={handleToday}
              className="text-sm font-semibold transition hover:opacity-70"
              style={{ color: BRAND }}
            >
              {isKo ? '오늘' : 'Today'}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
              >
                {isKo ? '취소' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="rounded-xl px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                style={{ backgroundColor: BRAND }}
              >
                {isKo ? '적용' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
