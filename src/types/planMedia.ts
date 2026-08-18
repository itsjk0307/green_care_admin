export type PlanMediaType = 'image' | 'video'

export type PlanMediaItem = {
  id: string
  plan_id?: string
  media_type: PlanMediaType
  file_name?: string | null
  file_url?: string | null
  file_path?: string | null
  thumbnail_url?: string | null
  thumbnail_path?: string | null
  caption?: string | null
  created_at?: string
}

export function detectMediaType(file: File): PlanMediaType {
  if (file.type.startsWith('video/')) return 'video'
  return 'image'
}
