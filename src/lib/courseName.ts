import type { GolfCourse } from '../types/api'
import type { Language } from '../i18n/translations'

/** Normalize KO course labels for lookup (strip spaces / common suffixes). */
function normalizeCourseKey(raw: string): string {
  return raw
    .replace(/\s+/g, '')
    .replace(/[·・]/g, '')
    .toLowerCase()
}

/**
 * Known Korean course names → English display names.
 * Keys should be space-free Korean (and common aliases).
 */
const COURSE_NAME_EN: Record<string, string> = {
  디오션골프클럽: 'The Ocean Golf Club',
  디오션cc: 'The Ocean CC',
  디오션컨트리클럽: 'The Ocean Country Club',
  디오션: 'The Ocean',
  이천마이다스cc: 'Icheon Midas CC',
  이천마이다스: 'Icheon Midas',
  제이퍼블릭골프클럽: 'J Public Golf Club',
  제이퍼블릭: 'J Public',
  메이플비치골프클럽: 'Maple Beach Golf Club',
  메이플비치: 'Maple Beach',
  사이프러스골프앤리조트: 'Cypress Golf & Resort',
  사이프러스: 'Cypress',
  캐슬파인골프클럽: 'Castle Pine Golf Club',
  캐슬파인: 'Castle Pine',
  성문안골프클럽: 'Seongmunan Golf Club',
  성문안: 'Seongmunan',
  카스카디아골프클럽: 'Cascadia Golf Club',
  카스카디아: 'Cascadia',
  솔트베이골프클럽: 'Salt Bay Golf Club',
  솔트베이: 'Salt Bay',
  청라: 'Cheongna',
  정남진: 'Jeongnamjin',
  정남진골프클럽: 'Jeongnamjin Golf Club',
  드비치: 'The Beach',
  오로라: 'Aurora',
  청평마이다스: 'Cheongpyeong Midas',
  청평마이다스cc: 'Cheongpyeong Midas CC',
  오크밸리골프클럽: 'Oak Valley Golf Club',
  오크밸리: 'Oak Valley',
  골든베이: 'Golden Bay',
  양지파인: 'Yangji Pine',
  안성포웰: 'Anseong Powell',
  베어즈베스트청라: "Bear's Best Cheongna",
  베어즈베스트: "Bear's Best",
}

type CourseNameFields = Pick<GolfCourse, 'name' | 'name_ko'> & {
  name_en?: string | null
}

function lookupEnglish(name: string): string | null {
  const key = normalizeCourseKey(name)
  if (COURSE_NAME_EN[key]) return COURSE_NAME_EN[key]

  // Try without common suffixes
  const stripped = key
    .replace(/(골프클럽|골프앤리조트|컨트리클럽|골프장|cc)$/i, '')
  if (stripped && COURSE_NAME_EN[stripped]) return COURSE_NAME_EN[stripped]

  return null
}

/** Localized display name for a golf course. */
export function courseDisplayName(
  course: CourseNameFields,
  language: Language,
): string {
  const ko = (course.name_ko || course.name || '').trim()
  const enApi = course.name_en?.trim()
  const apiName = (course.name || '').trim()

  if (language === 'ko') {
    return ko || apiName || '—'
  }

  if (enApi) return enApi

  const mapped =
    (ko ? lookupEnglish(ko) : null) ?? (apiName ? lookupEnglish(apiName) : null)
  if (mapped) return mapped

  // Prefer API `name` when it already looks Latin / English
  if (apiName && apiName !== ko && /[A-Za-z]/.test(apiName)) {
    return apiName
  }

  return ko || apiName || '—'
}
