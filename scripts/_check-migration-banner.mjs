/** After migration: fetchReports from server, confirm migration banner cleared. */
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ORIGIN = 'http://localhost:5173'
const chromeDefault = path.join(os.homedir(), 'AppData/Local/Google/Chrome/User Data/Default')
const profileDir = path.join(os.tmpdir(), 'gc-pw-post-migrate')

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.cpSync(src, dest, { recursive: true, force: true })
}

if (fs.existsSync(profileDir)) fs.rmSync(profileDir, { recursive: true, force: true })
fs.mkdirSync(path.join(profileDir, 'Default'), { recursive: true })
copyDir(path.join(chromeDefault, 'Local Storage', 'leveldb'), path.join(profileDir, 'Default', 'Local Storage', 'leveldb'))

const auth = JSON.parse(execFileSync('python', ['scripts/_extract_chrome_auth.py'], { encoding: 'utf8' }))
const context = await chromium.launchPersistentContext(profileDir, { headless: true, channel: 'chrome' })
await context.addInitScript(({ token, user }) => {
  localStorage.setItem('access_token', token)
  if (user) localStorage.setItem('greencare-admin-user', JSON.stringify(user))
}, { token: auth.token, user: auth.user })

const page = context.pages()[0] ?? (await context.newPage())
await page.goto(`${ORIGIN}/report-history`, { waitUntil: 'networkidle', timeout: 180000 })

const mapTab = page.locator('button').filter({ hasText: /Map work PDFs|지도 작업 PDF/ })
if (await mapTab.count()) await mapTab.first().click()
await page.waitForTimeout(1500)

const state = await page.evaluate(async () => {
  const { useMapReportStore } = await import('/src/stores/mapReportStore.ts')
  const store = useMapReportStore.getState()
  await store.fetchReports(undefined, () => '')
  const dry = await store.runMigrationDryRun()
  const reports = useMapReportStore.getState().reports
  return {
    migrationDryRunCount: dry.length,
    localOnlyCount: reports.filter((r) => !r.serverId).length,
    syncedCount: reports.filter((r) => r.syncStatus === 'synced').length,
    totalReports: reports.length,
    bannerVisible: dry.length > 0,
    mobileHints: reports
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

const bannerLocator = page.locator('text=Local PDF migration pending').or(
  page.locator('text=로컬 PDF 마이그레이션 대기'),
)
state.bannerInDom = (await bannerLocator.count()) > 0

console.log(JSON.stringify(state, null, 2))
await context.close()
