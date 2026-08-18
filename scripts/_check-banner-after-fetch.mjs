/**
 * Reconcile Chrome localStorage with server after migration:
 * fetchReports + confirm migration banner cleared.
 */
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ORIGIN = 'http://localhost:5173'
const chromeDefault = path.join(os.homedir(), 'AppData/Local/Google/Chrome/User Data/Default')
const profileDir = path.join(os.tmpdir(), 'gc-pw-banner-check')

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.cpSync(src, dest, { recursive: true, force: true })
}

if (fs.existsSync(profileDir)) fs.rmSync(profileDir, { recursive: true, force: true })
fs.mkdirSync(path.join(profileDir, 'Default'), { recursive: true })
copyDir(path.join(chromeDefault, 'Local Storage', 'leveldb'), path.join(profileDir, 'Default', 'Local Storage', 'leveldb'))
copyDir(path.join(os.tmpdir(), 'gc-pw-migrate-profile', 'Default', 'Local Storage', 'leveldb'), path.join(profileDir, 'Default', 'Local Storage', 'leveldb'))

const auth = JSON.parse(execFileSync('python', ['scripts/_extract_chrome_auth.py'], { encoding: 'utf8' }))
const context = await chromium.launchPersistentContext(profileDir, { headless: true, channel: 'chrome' })

// Fresh login if stored token is stale
const page = context.pages()[0] ?? (await context.newPage())
await page.goto(`${ORIGIN}/login`, { waitUntil: 'networkidle', timeout: 120000 })

const loginResult = await page.evaluate(async ({ email }) => {
  try {
    const { loginRequest } = await import('/src/api/auth.ts')
    const data = await loginRequest(email, 'admin123')
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem(
      'greencare-admin-user',
      JSON.stringify({
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
      }),
    )
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}, { email: auth.user?.email ?? 'admin@gmail.com' })

if (!loginResult.ok) {
  console.log(JSON.stringify({ loginResult }, null, 2))
  await context.close()
  process.exit(1)
}

await page.goto(`${ORIGIN}/report-history`, { waitUntil: 'networkidle', timeout: 180000 })
const mapTab = page.locator('button').filter({ hasText: /Map work PDFs|지도 작업 PDF/ })
if (await mapTab.count()) await mapTab.first().click()
await page.waitForTimeout(1500)

const state = await page.evaluate(async () => {
  const { useMapReportStore } = await import('/src/stores/mapReportStore.ts')
  const { fetchCourses } = await import('/src/api/courses.ts')
  const courses = await fetchCourses()
  const name = (id) => courses.find((c) => c.id === id)?.name ?? id
  await useMapReportStore.getState().fetchReports(undefined, name)
  const dry = await useMapReportStore.getState().runMigrationDryRun()
  const reports = useMapReportStore.getState().reports
  return {
    migrationDryRunCount: dry.length,
    localOnlyCount: reports.filter((r) => !r.serverId).length,
    syncedCount: reports.filter((r) => r.syncStatus === 'synced').length,
    mobile: reports
      .filter((r) => /oak|오크|midas|마이다스|이천/i.test(JSON.stringify(r)))
      .map((r) => ({
        id: r.id,
        courseName: r.courseName,
        workDate: r.workDate,
        serverId: r.serverId,
        syncStatus: r.syncStatus,
      })),
  }
})

const banner = page.locator('text=Local PDF migration pending').or(
  page.locator('text=로컬 PDF 마이그레이션'),
)
state.bannerInDom = (await banner.count()) > 0
console.log(JSON.stringify(state, null, 2))
await context.close()
