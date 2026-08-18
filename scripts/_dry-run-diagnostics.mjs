import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ORIGIN = 'http://localhost:5173'
const chromeDefault = path.join(os.homedir(), 'AppData/Local/Google/Chrome/User Data/Default')
const profileDir = path.join(os.tmpdir(), 'gc-pw-dryrun-profile')

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.cpSync(src, dest, { recursive: true, force: true })
}

if (fs.existsSync(profileDir)) fs.rmSync(profileDir, { recursive: true, force: true })
fs.mkdirSync(path.join(profileDir, 'Default'), { recursive: true })
copyDir(path.join(chromeDefault, 'Local Storage', 'leveldb'), path.join(profileDir, 'Default', 'Local Storage', 'leveldb'))
const idbRoot = path.join(chromeDefault, 'IndexedDB')
for (const name of fs.readdirSync(idbRoot)) {
  if (name.startsWith('http_localhost_5173')) {
    copyDir(path.join(idbRoot, name), path.join(profileDir, 'Default', 'IndexedDB', name))
  }
}

const auth = JSON.parse(execFileSync('python', ['scripts/_extract_chrome_auth.py'], { encoding: 'utf8' }))
const context = await chromium.launchPersistentContext(profileDir, {
  headless: true,
  channel: 'chrome',
})
await context.addInitScript(({ token, user }) => {
  localStorage.setItem('access_token', token)
  if (user) localStorage.setItem('greencare-admin-user', JSON.stringify(user))
}, { token: auth.token, user: auth.user })

const page = context.pages()[0] ?? (await context.newPage())
await page.goto(`${ORIGIN}/report-history`, { waitUntil: 'networkidle', timeout: 180000 })

const mapTab = page.locator('button').filter({ hasText: /Map work PDFs|지도 작업 PDF/ })
if (await mapTab.count()) await mapTab.first().click()
await page.waitForTimeout(2000)

const dryRun = await page.evaluate(async () => {
  const { useMapReportStore } = await import('/src/stores/mapReportStore.ts')
  const candidates = await useMapReportStore.getState().runMigrationDryRun()
  const locals = useMapReportStore.getState().reports.filter((r) => !r.serverId)
  return {
    count: locals.length,
    hasPdfAlready: candidates.filter((c) => c.hasPdf).length,
    canRebuild: candidates.filter((c) => c.canRebuild).length,
    missingCoreData: candidates.filter((c) => c.missingCoreData).length,
    candidates: candidates.map((c) => ({
      id: c.id,
      course: c.courseName,
      workDate: c.workDate,
      createdAt: c.createdAt,
      markCount: c.markCount,
      hasPdf: c.hasPdf,
      hasMapImage: c.hasMapImage,
      canRebuild: c.canRebuild,
      missingCoreData: c.missingCoreData,
      syncStatus: c.syncStatus,
    })),
  }
})

console.log(JSON.stringify(dryRun, null, 2))
await context.close()
