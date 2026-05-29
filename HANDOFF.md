# GreenCare Admin — Full Project Handoff

> Last updated: 2026-05-28  
> Branch: `main` | Backend: `http://192.168.0.61:8010`

---

## 1. Project Overview

GreenCare Admin is a React single-page application for managing golf course maintenance operations. Administrators can review worker field reports, create daily work plans, monitor drone scans, track issues on a course map, browse photos, read work journals, and receive real-time notifications.

The app is bilingual (Korean / English) and designed for desktop use (minimum 1024px wide).

---

## 2. Tech Stack

| Layer | Library / Version |
|---|---|
| Framework | React 19 |
| Language | TypeScript 6 |
| Build | Vite 8 |
| Styling | TailwindCSS v4 (Vite plugin, no config file) |
| Routing | React Router v7 |
| Server state | TanStack React Query v5 |
| Client state | Zustand v5 |
| Map | Leaflet 1.9 (imperative API — react-leaflet installed but unused) |
| Icons | Heroicons v2 (24/outline) |
| Toasts | react-hot-toast v2 |
| Font | Pretendard (CDN via index.css) |

**Dev tooling:** ESLint with react-hooks + react-refresh plugins, no Prettier config.

---

## 3. Running the Project

```bash
npm install
npm run dev       # http://localhost:5173 — proxies /api → http://127.0.0.1:8000
npm run build     # tsc -b && vite build
```

The Vite proxy target defaults to `http://127.0.0.1:8000`. To point at the real backend:
```bash
# .env.local
VITE_API_PROXY_TARGET=http://192.168.0.61:8010
```

In **production** builds (`npm run build`) the hardcoded fallback is `http://192.168.0.61:8010/api/v1`.

---

## 4. Project Structure

```
src/
├── api/            # Low-level fetch wrappers (auth, client, courses, users, dailyPlans)
├── components/
│   ├── drone/      # ScanList, ScanDetailView, ScanResultCard, DiseaseOverlay, UploadScanModal
│   ├── issues/     # IssueMapView, IssueListPanel, IssueDetailSidebar, CreateIssueModal, IssuePinMarker
│   ├── journal/    # MonthlyCalendar, DailyJournalView, ExcelExportModal
│   ├── layout/     # AppLayout, Header, Sidebar, NotificationBell, NotificationDropdown, NotificationItem
│   ├── map/        # LeafletMap, PhotoDetailPanel, CalibrationModal  ← Course Map feature
│   ├── photobox/   # HolePhotoSummary, PhotoLightbox
│   ├── plan/       # PlanStatusBoard, WorkerAttendanceSection, ZoneTaskRow
│   └── ui/         # Badge, Button, Card, LoadingSpinner, EmptyState, Modal, PhotoViewerModal
├── constants/      # dailyPlan.ts (ZONE_OPTIONS, TASK_OPTIONS, WEATHER_OPTIONS, helpers)
├── context/        # AuthContext.tsx (user + login/logout)
├── data/           # mockData.ts (mock work reports + diseases for Dashboard/WorkReports/DiseaseReports)
├── hooks/          # useMediaQuery.ts
├── i18n/           # translations.ts (ko + en string maps)
├── lib/            # devLog, droneScanUi, formatKoreanDate, formatScanDate, issueUi, journalUi, notificationUi
├── pages/          # One file per route (see §7)
├── services/       # courseMapService.js, dailyPlanService, droneScanService, issueService,
│                   # journalService, notificationService, photoService
├── stores/         # authStore.ts, languageStore.ts
└── types/          # api.ts, dailyPlan.ts, droneScan.ts, issue.ts, journal.ts, notification.ts, photo.ts
```

---

## 5. Authentication

**Flow:**
1. `LoginPage` calls `loginRequest(email, password)` → `POST /api/v1/auth/login`
2. Response: `{ access_token, refresh_token, user: { id, name, email, role, is_active } }`
3. Token stored in `localStorage` under key `access_token`; also pushed into `authStore` (Zustand persisted)
4. `AuthContext` stores the `AuthUser` object in `localStorage` under key `greencare-admin-user`
5. All subsequent API calls: `apiRequest()` auto-attaches `Authorization: Bearer <token>`

**Auth guard:** `Protected` wrapper in `App.tsx` reads `useAuth().user`. If null → redirect `/login`.

**Logout:** clears both localStorage keys and Zustand state.

---

## 6. API Layer

### `src/api/client.ts` — `apiRequest<T>(path, options)`

- Prepends `API_BASE_URL` (= `/api/v1` in dev, `http://192.168.0.61:8010/api/v1` in prod)
- Injects `Authorization` header automatically
- Unwraps the standard envelope: `{ success: boolean, message: string, data: T }`
- Throws `ApiError` (has `.status: number`) on HTTP errors or `success: false`
- Logs to Vite terminal via `devTerminalLog` in dev

```ts
// Standard backend envelope
type ApiResponse<T> = { success: boolean; message: string; data: T }
```

### Media / Storage URLs

Backend stores file paths as relative strings like `storage/photos/abc.jpg`. Three resolver helpers normalise these to full URLs:

| Helper | Used in |
|---|---|
| `resolveMediaUrl(path)` | `courseMapService.js` |
| `resolveStorageUrl(path)` | `issueService.ts` |
| `resolvePhotoUrl(path)` | `photoService.ts` |

All three follow the same logic:
- If already `http://…` → return as-is
- In dev → prepend empty string (Vite proxy handles `/storage/…`)
- In prod → prepend `http://192.168.0.61:8010`

---

## 7. Pages & Routes

| Route | Component | Data source |
|---|---|---|
| `/login` | `LoginPage` | `POST /auth/login` |
| `/` | `DashboardPage` | **Mock data** |
| `/work-reports` | `WorkReportsPage` | **Mock data** (approve/reject is UI-only) |
| `/daily-plans` | `DailyPlanPage` | **Real API** |
| `/disease-reports` | `DiseaseReportsPage` | **Mock data** |
| `/drone-scans` | `DroneScanPage` | **Real API** |
| `/issues` | `IssuesPage` | **Real API** |
| `/photo-box` | `PhotoBoxPage` | **Real API** |
| `/journal` | `JournalPage` | **Real API** |
| `/notifications` | `NotificationsPage` | **Real API** |
| `/course-map` | `CourseMapPage` | **Real API** |

> **Important:** Dashboard, Work Reports, and Disease Reports pages use `src/data/mockData.ts`. They will need real API integration.

---

## 8. Feature Details

### 8.1 Layout (`AppLayout`)

- Fixed left `Sidebar` (collapsible; state persisted to `gc-sidebar-collapsed` in localStorage)
- Fixed top `Header` with title, breadcrumbs, notification bell, language toggle, and logout
- On screens ≤ 1023px the sidebar auto-collapses
- Sidebar width: 240px expanded / 64px collapsed — `main` adjusts `padding-left` via inline style

### 8.2 Daily Plans (`/daily-plans`)

Left panel: course selector, weather, temp, rainfall, special notes, zone tasks, worker attendance. Right panel: status board of the selected plan.

Key service calls:
- `GET /daily-plans/today?course_id=` → hydrate form if plan exists
- `POST /daily-plans/` → create new plan
- `POST /daily-plans/{id}/zones` → add zone task
- `POST /daily-plans/{id}/attendance` → save attendance
- `POST /daily-plans/{id}/publish` → publish plan

Course ID persisted to `greencare-daily-plan-course-id`.

### 8.3 Drone Scans (`/drone-scans`)

Two-panel: scan list on left, scan detail + disease overlay on right. Upload modal sends multipart to `POST /drone-scans/`. Disease overlay renders coloured regions from scan analysis data.

Course ID persisted to `greencare-drone-scan-course-id`.

### 8.4 Issues (`/issues`)

Three-panel: toolbar (course + type filter + register button), map view (Leaflet, `L.CRS.Simple` with course image overlay, percentage-based pin positions), list panel, detail sidebar.

Issue pins store position as `pin_x / pin_y` (0–100 percentage of image dimensions). `IssueMapView` converts these to pixel positions when rendering.

Course ID persisted to `greencare-issues-course-id`.

### 8.5 PhotoBox (`/photo-box`)

Hole summary strip at top (click to filter by hole). Below: masonry grid or table list with pagination. Supports date range + hole + photo type filters. Lightbox for full-screen view.

Course ID persisted to `greencare-photobox-course-id`.

### 8.6 Work Journal (`/journal`)

Monthly calendar sidebar (shows dots on days with entries). Click a date → `DailyJournalView` loads that day's plan detail. Excel export modal.

Course ID persisted to `greencare-journal-course-id`.

### 8.7 Notifications (`/notifications`)

Infinite-scroll list with read/unread/all tabs. `markAllAsRead` + per-item delete. `NotificationBell` in the header shows unread count badge and a dropdown preview.

### 8.8 Course Map (`/course-map`)

Full-bleed page (breaks out of `AppLayout`'s `p-6` using `-mx-6 -mt-6 -mb-6`).

**Components:**
- `CourseMapPage.jsx` — top bar, course selector, refresh
- `LeafletMap.jsx` — map init, calibration flow, pins, worker dots
- `PhotoDetailPanel.jsx` — right sidebar / bottom sheet
- `CalibrationModal.jsx` — GPS coordinate input

**Map setup:** uses `L.CRS.Simple` (flat PNG image, not globe). Image dimensions loaded via `new Image()` before map init so bounds are exact.

**GPS Calibration:** Two-point affine mapping from GPS → pixel coordinates. Saved to `localStorage` under `greencare_calibration_{courseId}` as:
```json
{
  "point1": { "pixel_x": 120, "pixel_y": 340, "lat": 37.123456, "lng": 127.123456 },
  "point2": { "pixel_x": 890, "pixel_y": 780, "lat": 37.134567, "lng": 127.145678 }
}
```
Without calibration, a yellow banner is shown; GPS-dependent pins are hidden.

**Live data:** photos and active worker positions refetch every 30 seconds (`refetchInterval: 30_000`).

Course ID persisted to `greencare-course-map-course-id`.

---

## 9. State Management

### Zustand stores

| Store | Key (localStorage) | Purpose |
|---|---|---|
| `authStore` | `greencare-auth-store` | Access token — read by `apiRequest()` |
| `languageStore` | `greencare-lang-store` | Current language (`ko`/`en`) + `t(key)` helper |

### React Query

Default config: `staleTime: 60_000`, `retry: 1`.

Common query keys used across pages:

| Query key | Endpoint |
|---|---|
| `['courses']` | `/courses/` or `/golf-courses/` |
| `['course-detail', courseId]` | `/golf-courses/{courseId}` |
| `['workers', courseId]` | `/users/?role=worker&course_id=` |
| `['daily-plan-today', courseId]` | `/daily-plans/today?course_id=` |
| `['drone-scans', courseId]` | `/drone-scans/?course_id=` |
| `['issues', courseId, filters]` | `/issues/?course_id=&...` |
| `['photos', courseId, filters, page]` | `/photos/?course_id=&...` |
| `['field-photos', courseId]` | `/work-reports/field-photos?course_id=` |
| `['active-workers', courseId]` | `/gps/active?course_id=` |
| `['notifications-infinite', filter]` | `/notifications/?page=&...` |
| `['unread-count']` | `/notifications/unread-count` |

---

## 10. localStorage Keys Reference

| Key | What it stores |
|---|---|
| `access_token` | JWT bearer token |
| `greencare-admin-user` | `AuthUser` JSON (id, name, email, role) |
| `greencare-auth-store` | Zustand persisted auth (wraps access_token) |
| `gc-sidebar-collapsed` | `'0'` or `'1'` |
| `greencare_calibration_{courseId}` | 2-point GPS calibration JSON for course map |
| `greencare-course-map-course-id` | Last selected course on `/course-map` |
| `greencare-daily-plan-course-id` | Last selected course on `/daily-plans` |
| `greencare-drone-scan-course-id` | Last selected course on `/drone-scans` |
| `greencare-issues-course-id` | Last selected course on `/issues` |
| `greencare-journal-course-id` | Last selected course on `/journal` |
| `greencare-photobox-course-id` | Last selected course on `/photobox` |

---

## 11. Backend API Endpoints

All paths relative to `http://192.168.0.61:8010/api/v1`.

### Auth
```
POST  /auth/login                              body: { email, password }
```

### Courses
```
GET   /courses/                                list all (tried first)
GET   /golf-courses/                           list all (fallback)
GET   /golf-courses/{courseId}                 single course detail
```

### Users / Workers
```
GET   /users/?role=worker&course_id={id}
```

### Daily Plans
```
GET   /daily-plans/today?course_id={id}
GET   /daily-plans/{planId}
POST  /daily-plans/                            body: CreatePlanBody
POST  /daily-plans/{planId}/zones              body: AddZoneTaskBody
PATCH /daily-plans/zones/{zoneTaskId}          body: UpdateZoneTaskBody
POST  /daily-plans/{planId}/attendance         body: AttendanceItem[]
POST  /daily-plans/{planId}/publish
GET   /daily-plans/{planId}/workers
```

### Drone Scans
```
GET   /drone-scans/?course_id={id}
GET   /drone-scans/{scanId}
POST  /drone-scans/                            multipart/form-data
```

### Issues
```
GET   /issues/?course_id={id}&status={}&issue_type={}
GET   /issues/{issueId}
POST  /issues/                                 multipart/form-data
PATCH /issues/{issueId}                        body: UpdateIssueBody
DELETE /issues/{issueId}
```

### Photos (PhotoBox)
```
GET   /photos/?course_id={id}&page={}&from_date={}&to_date={}&hole_number={}&photo_type={}
GET   /photos/by-hole?course_id={id}
```

### Work Journal
```
GET   /work-journals/?course_id={id}&date={YYYY-MM-DD}
GET   /work-journals/calendar?course_id={id}&year={}&month={}
GET   /work-journals/{planId}/export            → blob download
```

### Notifications
```
GET   /notifications/?page={}&per_page=20&is_read=true/false
GET   /notifications/unread-count
PATCH /notifications/{id}/read
PATCH /notifications/read-all
DELETE /notifications/{id}
```

### Course Map
```
GET   /work-reports/field-photos?course_id={id}   → FieldPhoto[]
PATCH /work-reports/{photoId}/status               body: { status }
GET   /gps/active?course_id={id}                  → WorkerLocation[]
```

---

## 12. Key Types

```ts
// src/types/api.ts
type GolfCourse = { id, name, name_ko, address, map_image_path, is_active, ... }
type AppUser    = { id, name, email, role, is_active, ... }
type DailyWorkPlan = { id, course_id, plan_date, weather, zone_tasks, attendance, ... }
type DailyZoneTask = { id, zone, task_types, mowing_height_mm, assigned_worker_ids, status, ... }

// src/types/issue.ts
type Issue = { id, course_id, title, issue_type, priority, status, pin_x, pin_y, ... }
// pin_x / pin_y are percentages (0–100) of image width/height

// Course map (no shared type file — inferred from API)
// FieldPhoto: { id, worker_name, gps_latitude, gps_longitude, image_url, notes, created_at, status }
// WorkerLocation: { worker_id, worker_name, latitude, longitude }
```

---

## 13. UI Conventions

- **Colours:** Primary `#1B5E20` (emerald-900), background `#F7F8F7`, card white, border `#EEEEEE`, radius 16px (`rounded-2xl`). Status colours: done `#10B981`, pending `#F59E0B`, error `#EF4444`.
- **Tailwind only** — no inline styles except inside `L.divIcon` HTML strings (Leaflet constraint).
- **Toast classes:** `gc-toast-success`, `gc-toast-error`, `gc-toast-info` (defined in `index.css`).
- **Loading:** `<LoadingSpinner message="…" />` — spinner + message.
- **Empty states:** `<EmptyState />` component or inline paragraph with `text-slate-400`.
- **Page enter animation:** add `page-enter` class to the root div of a page for fade-in.
- **Course selector pattern:** every page that needs a course: load `fetchCourses()`, default to first active, persist chosen ID to localStorage.

---

## 14. Known Gaps / TODOs

| Area | Issue |
|---|---|
| Dashboard | Uses `mockData.ts` — stat cards and recent reports need real API |
| Work Reports | Approve/reject mutations are local state only — needs `PATCH /work-reports/{id}/status` |
| Disease Reports | Entirely mock — needs real drone analysis API integration |
| Course Map | `getCourse()` calls `/golf-courses/{courseId}` which duplicates the `/golf-courses/` list call; consider caching |
| Course Map | No error recovery if calibration points are too close (scale becomes ∞) |
| Notifications | `markAllAsRead` calls `/notifications/read-all` but backend may use `/notifications/mark-all-read` — verify endpoint name |
| Auth | No refresh-token rotation — on 401 the user is not automatically redirected to login |
| TypeScript | `.jsx` files (`CourseMapPage`, `LeafletMap`, `PhotoDetailPanel`, `CalibrationModal`, `courseMapService`) are plain JS; `allowJs: true` added to tsconfig enables compilation but they have no type safety |

---

## 15. Adding a New Page (Checklist)

1. Create `src/pages/MyPage.tsx`
2. Add translation key to `src/i18n/translations.ts` (both `ko` and `en`)
3. Add nav item to `NAV_ITEMS` in `src/components/layout/Sidebar.tsx`
4. Add route to `ROUTE_MAP` in `src/components/layout/AppLayout.tsx`
5. Add `<Route>` in `App.tsx`
6. Add service functions in `src/services/myService.ts` using `apiRequest()`
7. Add types in `src/types/myType.ts`
