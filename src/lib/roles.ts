/** Roles allowed to use the admin web panel (workers remain mobile-only). */
export const ADMIN_PANEL_ROLES = ['admin', 'manager', 'course_manager'] as const

export type AdminPanelRole = (typeof ADMIN_PANEL_ROLES)[number]

export function normalizeRole(role: string | null | undefined): string {
  return (role ?? '').trim().toLowerCase()
}

/** True for admin / manager / course_manager (case-insensitive). */
export function canAccessAdminPanel(role: string | null | undefined): boolean {
  const r = normalizeRole(role)
  return (ADMIN_PANEL_ROLES as readonly string[]).includes(r)
}

export function isAdminRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'admin'
}

/** Course selector is locked to assigned_course_id for this role. */
export function isCourseScopedRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'course_manager'
}
