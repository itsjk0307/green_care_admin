export type DroneScanStatus =
  | 'uploaded'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'

export type DiseaseSeverity =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical'
  | 'healthy'

export type DroneScanResult = {
  id: string
  hole_number?: number | null
  hole_label?: string | null
  disease_type: string
  disease_name?: string | null
  disease_name_ko?: string | null
  confidence: number
  severity: DiseaseSeverity
  affected_percent?: number | null
  affected_area_percent?: number | null
  recommendation?: string | null
  recommendation_ko?: string | null
  bbox_x?: number | null
  bbox_y?: number | null
  bbox_width?: number | null
  bbox_height?: number | null
}

export type DroneScanSummary = {
  id: string
  course_id: string
  course_name?: string | null
  course_name_ko?: string | null
  scan_date: string
  status: DroneScanStatus
  notes?: string | null
  image_path?: string | null
  image_url?: string | null
  result_count?: number | null
  uploaded_by?: string | null
  uploaded_by_name?: string | null
  created_at?: string
}

export type DroneScanDetail = DroneScanSummary & {
  image_width?: number | null
  image_height?: number | null
  results?: DroneScanResult[]
  detections?: DroneScanResult[]
}

export function scanResults(scan: DroneScanDetail): DroneScanResult[] {
  return scan.results ?? scan.detections ?? []
}
