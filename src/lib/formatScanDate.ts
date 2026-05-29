export function formatScanDate(iso: string): string {
  const datePart = iso.slice(0, 10)
  const [y, m, d] = datePart.split('-')
  if (!y || !m || !d) return iso
  return `${y}.${m}.${d}`
}

export function formatKoreanScanDate(iso: string): string {
  const datePart = iso.slice(0, 10)
  const [y, m, d] = datePart.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${y}년 ${m}월 ${d}일`
}

export function todayLocalDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
