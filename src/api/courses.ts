import { apiRequest } from './client'
import type { GolfCourse } from '../types/api'

export function fetchCourses() {
  return apiRequest<GolfCourse[]>('/courses/')
}
