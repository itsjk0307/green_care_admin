/** Sync one remaining local-only report by client_id (force rebuild). */
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CLIENT_ID = process.argv[2]
if (!CLIENT_ID) {
  console.error('Usage: node scripts/sync-one-map-report.mjs <client_id>')
  process.exit(1)
}

const ORIGIN = 'http://localhost:5173'
const chromeDefault = path.join(os.homedir(), 'AppData/Local/Google/Chrome/User Data/Default')
const profileDir = path.join(os.tmpdir(), 'gc-pw-sync-one')

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.cpSync(src, dest, { recursive: true, force: true })
}

if (fs.existsSync(profileDir)) fs.rmSync(profileDir, { recursive: true, force: true })
fs.mkdirSync(path.join(profileDir, 'Default'), { recursive: true })
copyDir(path.join(chromeDefault, 'Local Storage', 'leveldb'), path.join(profileDir, 'Default', 'Local Storage', 'leveldb'))
const idbRoot = path.join(chromeDefault, 'IndexedDB')
if (fs.existsSync(idbRoot)) {
  for (const name of fs.readdirSync(idbRoot)) {
    if (name.startsWith('http_localhost_5173')) {
      copyDir(path.join(idbRoot, name), path.join(profileDir, 'Default', 'IndexedDB', name))
    }
  }
}

const auth = JSON.parse(execFileSync('python', ['scripts/_extract_chrome_auth.py'], { encoding: 'utf8' }))
const context = await chromium.launchPersistentContext(profileDir, { headless: true, channel: 'chrome' })
await context.addInitScript(({ token, user }) => {
  localStorage.setItem('access_token', token)
  if (user) localStorage.setItem('greencare-admin-user', JSON.stringify(user))
}, { token: auth.token, user: auth.user })

const page = context.pages()[0] ?? (await context.newPage())
await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' })

const result = await page.evaluate(async (id) => {
  const { useMapReportStore } = await import('/src/stores/mapReportStore.ts')
  const store = useMapReportStore.getState()
  const locals = store.reports.filter((r) => !r.serverId)
  const updated = await store.syncReport(id, { forceRebuildPdf: true })
  const dry = await store.runMigrationDryRun()
  return {
    localOnlyBefore: locals.map((r) => r.id),
    updated: {
      id: updated.id,
      syncStatus: updated.syncStatus,
      serverId: updated.serverId,
      lastError: updated.lastError,
    },
    migrationDryRunCount: dry.length,
  }
}, CLIENT_ID)

console.log(JSON.stringify(result, null, 2))
await context.close()
