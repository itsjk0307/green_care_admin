import type { ReactNode } from 'react'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { SignupPendingPage } from './pages/SignupPendingPage'
import { PendingApprovalsPage } from './pages/PendingApprovalsPage'
import { StaffOnlyPage } from './pages/StaffOnlyPage'
import { DashboardPage } from './pages/DashboardPage'
import { DailyPlanPage } from './pages/DailyPlan'
import { ReportHistoryPage } from './pages/ReportHistoryPage'
import { WorkReportDetailPage } from './pages/WorkReportDetailPage'
import { AiChatPage } from './pages/AiChatPage'
import { InventoryPage } from './pages/InventoryPage'
import { WorkersPage } from './pages/WorkersPage'
import { DroneScanPage } from './pages/DroneScanPage'
import { IssuesPage } from './pages/IssuesPage'
import { JournalPage } from './pages/JournalPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { SettingsPage } from './pages/SettingsPage'
import { SupportPage } from './pages/SupportPage'
import { CourseMapUploadPage } from './pages/CourseMapUploadPage'
import { LoadingSpinner } from './components/ui/LoadingSpinner'
import { canAccessAdminPanel, isAdminRole } from './lib/roles'

const CourseMapPage = lazy(() =>
  import('./pages/CourseMap').then((m) => ({ default: m.CourseMap })),
)

function Protected({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!canAccessAdminPanel(user.role)) {
    return <StaffOnlyPage attemptedRole={user.role} />
  }
  return <>{children}</>
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (user && canAccessAdminPanel(user.role)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!user || !isAdminRole(user.role)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicOnly>
            <SignupPage />
          </PublicOnly>
        }
      />
      <Route
        path="/signup/pending"
        element={
          <PublicOnly>
            <SignupPendingPage />
          </PublicOnly>
        }
      />
      <Route path="/access-denied" element={<StaffOnlyPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="work-reports" element={<Navigate to="/daily-plans" replace />} />
        <Route path="disease-reports" element={<Navigate to="/" replace />} />
        <Route path="daily-plans" element={<DailyPlanPage />} />
        <Route path="report-history" element={<ReportHistoryPage />} />
        <Route path="report-history/:planId" element={<WorkReportDetailPage />} />
        <Route path="ai" element={<AiChatPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="workers" element={<WorkersPage />} />
        <Route path="daily-plan" element={<Navigate to="/daily-plans" replace />} />
        <Route path="drone-scans" element={<DroneScanPage />} />
        <Route path="issues" element={<IssuesPage />} />
        <Route path="field-reports" element={<Navigate to="/" replace />} />
        <Route path="journal" element={<JournalPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="support" element={<SupportPage />} />
        <Route
          path="pending-approvals"
          element={
            <AdminOnly>
              <PendingApprovalsPage />
            </AdminOnly>
          }
        />
        <Route
          path="course-map"
          element={
            <Suspense fallback={<LoadingSpinner message="지도 불러오는 중…" />}>
              <CourseMapPage />
            </Suspense>
          }
        />
        <Route path="course-map/:courseId/upload" element={<CourseMapUploadPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-center" toastOptions={{ duration: 3200 }} />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
