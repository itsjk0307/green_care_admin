/**
 * Post-migration verification: API list, PDF sizes, banner state, mobile records.
 */
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ORIGIN = 'http://localhost:5173'
const LIMIT = 20 * 1024 * 1024
const LOCAL_IDS = [
  'b1ce2491-29dc-48b5-9b86-c977e65b61e1',
  '2cafb002-5e27-4752-a4db-1dcf6f82dcb4',
  '47bc8c78-1c02-41ef-9a23-55e4405df0b1',
  '3c125d23-5d49-413c-8bf8-e38f4daa5b55',
  '6157b726-99bc-41fc-bfce-85730a0427f6',
  '9e4d513c-d4c5-4218-8f7e-418fd3c73b98',
  'e03a5b25-f929-416d-91b3-05abf4de6cf9',
  '5c5afe99-b49c-4d28-83af-dd9af3f6c1bf',
  'bbead6de-a032-4d99-8fc7-65ac10c79ccc',
  '0c5e4203-1f02-4fbd-8405-2dac72ab09e7',
  '4bbd8f4c-5a12-47eb-9b04-fa113063a506',
]

const chromeDefault = path.join(os.homedir(), 'AppData/Local/Google/Chrome/User Data/Default')
const profileDir = path.join(os.tmpdir(), 'gc-pw-verify-migrate')

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
await page.waitForTimeout(1200)

const report = await page.evaluate(async ({ localIds, limit }) => {
  const { getMapReports } = await import('/src/services/mapReportService.ts')
  const { useMapReportStore } = await import('/src/stores/mapReportStore.ts')
  const store = useMapReportStore.getState()
  await store.fetchReports(undefined, (cid) => cid)
  const dry = await store.runMigrationDryRun()

  const { reports } = await getMapReports()
  const byClient = new Map(reports.map((r) => [r.client_id, r]))

  async function fileSize(url) {
    if (!url) return null
    try {
      const res = await fetch(url, { method: 'HEAD' })
      const cl = res.headers.get('content-length')
      return cl ? Number(cl) : null
    } catch {
      return null
    }
  }

  async function fetchOk(url) {
    if (!url) return false
    try {
      const res = await fetch(url, { method: 'GET' })
      return res.ok
    } catch {
      return false
    }
  }

  const migrated = []
  for (const cid of localIds) {
    const rec = byClient.get(cid)
    if (!rec) {
      migrated.push({ client_id: cid, found: false })
      continue
    }
    const pdfUrl = rec.pdf_url?.startsWith('http')
      ? rec.pdf_url
      : `${window.location.origin}${rec.pdf_url}`
    const imgUrl = rec.map_image_url?.startsWith('http')
      ? rec.map_image_url
      : `${window.location.origin}${rec.map_image_url}`
    const pdfBytes = await fileSize(pdfUrl)
    migrated.push({
      client_id: cid,
      found: true,
      server_id: rec.id,
      work_date: rec.work_date,
      course_id: rec.course_id,
      pdf_url: rec.pdf_url,
      map_image_url: rec.map_image_url,
      pdf_bytes: pdfBytes,
      pdf_mb: pdfBytes ? +(pdfBytes / (1024 * 1024)).toFixed(2) : null,
      under_20mb: pdfBytes != null && pdfBytes <= limit,
      pdf_ok: await fetchOk(pdfUrl),
      image_ok: await fetchOk(imgUrl),
    })
  }

  const mobile = reports
    .filter((r) => {
      const hay = JSON.stringify(r).toLowerCase()
      return /oak|오크|midas|마이다스|이천/.test(hay)
    })
    .map((r) => ({
      client_id: r.client_id,
      server_id: r.id,
      work_date: r.work_date,
      course_id: r.course_id,
      pdf_url: r.pdf_url,
      map_image_url: r.map_image_url,
    }))

  const localReports = useMapReportStore.getState().reports
  const mobileFromStore = localReports
    .filter((r) => /oak|오크|midas|마이다스|이천/i.test(JSON.stringify(r)))
    .map((r) => ({
      id: r.id,
      courseName: r.courseName,
      workDate: r.workDate,
      serverId: r.serverId,
      syncStatus: r.syncStatus,
    }))

  return {
    total_server_reports: reports.length,
    migrated,
    migrated_found: migrated.filter((m) => m.found).length,
    migrated_missing: migrated.filter((m) => !m.found).map((m) => m.client_id),
    all_under_20mb: migrated.filter((m) => m.found).every((m) => m.under_20mb),
    all_urls_ok: migrated.filter((m) => m.found).every((m) => m.pdf_ok && m.image_ok),
    migration_dry_run_count: dry.length,
    local_only_count: localReports.filter((r) => !r.serverId).length,
    mobile_api_matches: mobile,
    mobile_store_matches: mobileFromStore,
  }
}, { localIds: LOCAL_IDS, limit: LIMIT })

const bannerLocator = page.locator('text=Local PDF migration pending').or(
  page.locator('text=로컬 PDF 마이그레이션'),
)
report.banner_in_dom = (await bannerLocator.count()) > 0

console.log(JSON.stringify(report, null, 2))
await context.close()
