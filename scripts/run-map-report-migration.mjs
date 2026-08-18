/**
 * Upload all local-only map reports via migrateLocalOnlyReports().
 * Forces fresh PDF rebuild (MEDIUM compression) for every row.
 */
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ORIGIN = process.env.GC_DEV_ORIGIN ?? 'http://localhost:5173'
const chromeDefault = path.join(
  os.homedir(),
  'AppData/Local/Google/Chrome/User Data/Default',
)
const profileDir = path.join(os.tmpdir(), 'gc-pw-migrate-profile')

const LOCAL_CLIENT_IDS = [
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

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.cpSync(src, dest, { recursive: true, force: true })
}

if (fs.existsSync(profileDir)) fs.rmSync(profileDir, { recursive: true, force: true })
fs.mkdirSync(path.join(profileDir, 'Default'), { recursive: true })
copyDir(
  path.join(chromeDefault, 'Local Storage', 'leveldb'),
  path.join(profileDir, 'Default', 'Local Storage', 'leveldb'),
)
const idbRoot = path.join(chromeDefault, 'IndexedDB')
if (fs.existsSync(idbRoot)) {
  for (const name of fs.readdirSync(idbRoot)) {
    if (name.startsWith('http_localhost_5173')) {
      copyDir(
        path.join(idbRoot, name),
        path.join(profileDir, 'Default', 'IndexedDB', name),
      )
    }
  }
}

const auth = JSON.parse(
  execFileSync('python', ['scripts/_extract_chrome_auth.py'], { encoding: 'utf8' }),
)
if (!auth.token) throw new Error('No access_token in Chrome localStorage')

const context = await chromium.launchPersistentContext(profileDir, {
  headless: true,
  channel: 'chrome',
  viewport: { width: 1400, height: 900 },
})
await context.addInitScript(
  ({ token, user }) => {
    localStorage.setItem('access_token', token)
    if (user) localStorage.setItem('greencare-admin-user', JSON.stringify(user))
  },
  { token: auth.token, user: auth.user },
)

const page = context.pages()[0] ?? (await context.newPage())
await page.goto(`${ORIGIN}/report-history`, {
  waitUntil: 'networkidle',
  timeout: 180_000,
})
if (page.url().includes('/login')) {
  throw new Error(`Not authenticated — landed on ${page.url()}`)
}

console.error('[migrate] starting migrateLocalOnlyReports (forceRebuildPdf=true for all)...')
const outcome = await page.evaluate(async () => {
  const { useMapReportStore } = await import('/src/stores/mapReportStore.ts')
  const result = await useMapReportStore.getState().migrateLocalOnlyReports()
  const dryRun = useMapReportStore.getState().migrationDryRun
  return {
    uploaded: result.uploaded,
    failed: result.failed,
    results: result.results.map((r) => ({
      id: r.id,
      courseName: r.courseName,
      workDate: r.workDate,
      syncStatus: r.syncStatus,
      serverId: r.serverId,
      lastError: r.lastError,
    })),
    migrationDryRunCount: dryRun?.length ?? 0,
  }
})

const summary = {
  ...outcome,
  expectedClientIds: LOCAL_CLIENT_IDS,
}
console.log(JSON.stringify(summary, null, 2))
await context.close()
