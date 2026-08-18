import { apiRequest } from './client'

export type DiseaseDetectionResult = {
  disease_type: string
  confidence: number
  severity: string
  affected_area_percent: number
  recommendation_en: string
  recommendation_ko: string
  model_version: string
}

export function detectDisease(file: File): Promise<DiseaseDetectionResult> {
  const formData = new FormData()
  formData.append('image', file)
  return apiRequest<DiseaseDetectionResult>('/ai/detect-disease', {
    method: 'POST',
    body: formData,
  })
}
