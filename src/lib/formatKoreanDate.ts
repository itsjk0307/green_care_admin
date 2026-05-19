const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

export function formatKoreanLongDate(d: Date = new Date()): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${weekdays[d.getDay()]}`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}
