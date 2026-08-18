import { useAuth } from '../context/AuthContext'
import { isCourseScopedRole } from '../lib/roles'

/**
 * When role is course_manager, the UI must stay on assigned_course_id only.
 * Admin/manager users with null assigned_course_id keep free course selection.
 */
export function useCourseScope() {
  const { user } = useAuth()
  const isScoped = isCourseScopedRole(user?.role)
  const lockedCourseId =
    isScoped && user?.assignedCourseId ? user.assignedCourseId : undefined

  return { isScoped, lockedCourseId, user }
}
