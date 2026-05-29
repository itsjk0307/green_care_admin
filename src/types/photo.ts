export type PhotoTypeFilter = 'before' | 'after' | null

export type WorkPhoto = {
  id: string
  course_id: string
  hole_number: number
  photo_type?: 'before' | 'after' | null
  image_path?: string | null
  image_url?: string | null
  thumbnail_path?: string | null
  thumbnail_url?: string | null
  worker_id?: string | null
  worker_name?: string | null
  work_types?: string[]
  notes?: string | null
  taken_at?: string | null
  created_at: string
}

export type PhotoFilters = {
  from_date?: string | null
  to_date?: string | null
  hole_number?: number | null
  photo_type?: PhotoTypeFilter
}

export type PhotosPage = {
  items: WorkPhoto[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export type HolePhotoSummaryItem = {
  hole_number: number
  count: number
  latest_thumbnail?: string | null
  latest_image_path?: string | null
  latest_image_url?: string | null
  last_photo_date?: string | null
}
