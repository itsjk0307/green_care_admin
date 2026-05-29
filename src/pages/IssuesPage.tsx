import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { PlusIcon } from '@heroicons/react/24/outline'
import { fetchCourses } from '../api/courses'
import { ApiError } from '../api/client'
import { CreateIssueModal } from '../components/issues/CreateIssueModal'
import { IssueDetailSidebar } from '../components/issues/IssueDetailSidebar'
import { IssueListPanel } from '../components/issues/IssueListPanel'
import { IssueMapView } from '../components/issues/IssueMapView'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { ISSUE_TYPES } from '../lib/issueUi'
import { getIssues } from '../services/issueService'
import type { IssueFilters, IssueStatus, IssueType, PinPosition } from '../types/issue'

const COURSE_STORAGE_KEY = 'greencare-issues-course-id'

type ListStatusFilter = IssueStatus | 'all'

export function IssuesPage() {
  const queryClient = useQueryClient()
  const [courseId, setCourseId] = useState(
    () => localStorage.getItem(COURSE_STORAGE_KEY) ?? '',
  )
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [pendingPin, setPendingPin] = useState<PinPosition | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [registerMode, setRegisterMode] = useState(false)
  const [issueTypeFilter, setIssueTypeFilter] = useState<IssueType | null>(null)
  const [listStatusFilter, setListStatusFilter] = useState<ListStatusFilter>('open')

  const coursesQuery = useQuery({ queryKey: ['courses'], queryFn: fetchCourses })
  const courses = coursesQuery.data ?? []

  useEffect(() => {
    if (!courses.length) return
    if (!courseId || !courses.some((c) => c.id === courseId)) {
      const active = courses.find((c) => c.is_active) ?? courses[0]
      setCourseId(active.id)
    }
  }, [courses, courseId])

  useEffect(() => {
    if (courseId) localStorage.setItem(COURSE_STORAGE_KEY, courseId)
  }, [courseId])

  const apiFilters: IssueFilters = useMemo(() => {
    const filters: IssueFilters = {}
    if (issueTypeFilter) filters.issue_type = issueTypeFilter
    if (listStatusFilter !== 'all') filters.status = listStatusFilter
    return filters
  }, [issueTypeFilter, listStatusFilter])

  const issuesQuery = useQuery({
    queryKey: ['issues', courseId, apiFilters],
    queryFn: () => getIssues(courseId, apiFilters),
    enabled: Boolean(courseId),
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (issuesQuery.isError) {
      const message =
        issuesQuery.error instanceof ApiError
          ? issuesQuery.error.message
          : '이슈 목록을 불러오지 못했습니다.'
      toast.error(message, { className: 'gc-toast-error' })
    }
  }, [issuesQuery.isError, issuesQuery.error])

  const issues = issuesQuery.data ?? []

  function handleRegisterClick() {
    setRegisterMode(true)
    setPendingPin(null)
    toast('지도에서 이슈 위치를 클릭하세요.', { className: 'gc-toast-info' })
  }

  function handleMapClick(pin: PinPosition) {
    setPendingPin(pin)
    setRegisterMode(false)
    setShowCreateModal(true)
  }

  function invalidateIssues() {
    void queryClient.invalidateQueries({ queryKey: ['issues', courseId] })
  }

  if (coursesQuery.isLoading) {
    return <LoadingSpinner message="골프장 목록 불러오는 중…" />
  }

  return (
    <div className="page-enter flex h-[calc(100vh-7rem)] min-h-[640px] flex-col gap-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
        <select
          value={courseId}
          onChange={(e) => {
            setCourseId(e.target.value)
            setSelectedIssueId(null)
          }}
          className="h-10 min-w-[170px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-all duration-150 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_ko || c.name}
            </option>
          ))}
        </select>

        <div className="flex flex-1 flex-wrap gap-1.5">
          {ISSUE_TYPES.map((type) => {
            const active = issueTypeFilter === type.key
            return (
              <button
                key={type.key ?? 'all'}
                type="button"
                onClick={() => setIssueTypeFilter(type.key)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  active
                    ? type.chipClass
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {type.emoji} {type.label}
              </button>
            )
          })}
        </div>

        <Button
          icon={<PlusIcon className="h-4 w-4" />}
          onClick={handleRegisterClick}
        >
          이슈 등록
        </Button>
      </div>

      {/* ── Map + List ── */}
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="w-[55%] shrink-0">
          {issuesQuery.isLoading ? (
            <LoadingSpinner message="이슈 지도 불러오는 중…" />
          ) : (
            <IssueMapView
              courseId={courseId}
              issues={issues}
              selectedIssueId={selectedIssueId}
              registerMode={registerMode}
              onPinClick={setSelectedIssueId}
              onMapClick={handleMapClick}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {issuesQuery.isLoading ? (
            <LoadingSpinner message="이슈 목록 불러오는 중…" />
          ) : (
            <IssueListPanel
              issues={issues}
              selectedIssueId={selectedIssueId}
              statusFilter={listStatusFilter}
              onStatusFilterChange={setListStatusFilter}
              onSelect={setSelectedIssueId}
            />
          )}
        </div>
      </div>

      {selectedIssueId ? (
        <IssueDetailSidebar
          issueId={selectedIssueId}
          courseId={courseId}
          onClose={() => setSelectedIssueId(null)}
          onUpdate={invalidateIssues}
          onDelete={() => {
            setSelectedIssueId(null)
            invalidateIssues()
          }}
        />
      ) : null}

      <CreateIssueModal
        open={showCreateModal}
        courseId={courseId}
        initialPin={pendingPin}
        onClose={() => {
          setShowCreateModal(false)
          setPendingPin(null)
        }}
        onSuccess={(issueId) => {
          setSelectedIssueId(issueId)
          setShowCreateModal(false)
          setPendingPin(null)
          invalidateIssues()
        }}
      />
    </div>
  )
}
