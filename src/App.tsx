import type { ReactNode } from 'react'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { WorkReportsPage } from './pages/WorkReportsPage'
import { DiseaseReportsPage } from './pages/DiseaseReportsPage'
import { DailyPlanPage } from './pages/DailyPlan'
import { DroneScanPage } from './pages/DroneScanPage'
import { IssuesPage } from './pages/IssuesPage'
import { PhotoBoxPage } from './pages/PhotoBoxPage'
import { JournalPage } from './pages/JournalPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { CourseMapUploadPage } from './pages/CourseMapUploadPage'
import { LoadingSpinner } from './components/ui/LoadingSpinner'

const CourseMapPage = lazy(() =>
  import('./pages/CourseMapPage').then((m) => ({ default: m.CourseMapPage })),
)

function Protected({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (user) return <Navigate to="/" replace />
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
        path="/"
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="work-reports" element={<WorkReportsPage />} />
        <Route path="disease-reports" element={<DiseaseReportsPage />} />
        <Route path="daily-plans" element={<DailyPlanPage />} />
        <Route path="daily-plan" element={<Navigate to="/daily-plans" replace />} />
        <Route path="drone-scans" element={<DroneScanPage />} />
        <Route path="issues" element={<IssuesPage />} />
        <Route path="photo-box" element={<PhotoBoxPage />} />
        <Route path="journal" element={<JournalPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
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
