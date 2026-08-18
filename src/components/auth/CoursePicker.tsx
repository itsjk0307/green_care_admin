import { useMemo, useState } from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { courseDisplayName } from '../../lib/courseName'
import { useLanguageStore } from '../../stores/languageStore'
import type { SignupCourseOption } from '../../api/auth'

type Props = {
  courses: SignupCourseOption[]
  value: string
  onChange: (courseId: string) => void
  disabled?: boolean
  id?: string
}

export function CoursePicker({ courses, value, onChange, disabled, id }: Props) {
  const { language, t } = useLanguageStore()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return courses
    return courses.filter((c) => {
      const label = courseDisplayName(
        { name: c.name, name_ko: c.name_ko },
        language,
      ).toLowerCase()
      return (
        label.includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.name_ko.toLowerCase().includes(q)
      )
    })
  }, [courses, query, language])

  const inputClass =
    'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20'

  return (
    <div className="space-y-2">
      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('signupCourseSearchPh')}
          disabled={disabled}
          className={`${inputClass} pl-9`}
        />
      </div>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={inputClass}
      >
        <option value="">{t('signupCoursePlaceholder')}</option>
        {filtered.map((c) => (
          <option key={c.id} value={c.id}>
            {courseDisplayName({ name: c.name, name_ko: c.name_ko }, language)}
          </option>
        ))}
      </select>
      {query && filtered.length === 0 ? (
        <p className="text-xs text-slate-500">{t('signupCourseNoMatch')}</p>
      ) : null}
    </div>
  )
}
