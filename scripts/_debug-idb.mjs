import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ORIGIN = 'http://localhost:5173'
const REPORT_ID = 'b1ce2491-29dc-48b5-9b86-c977e65b61e1'
const chromeDefault = path.join(os.homedir(), 'AppData/Local/Google/Chrome/User Data/Default')
const profileDir = path.join(os.tmpdir(), 'gc-pw-debug-profile')

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return false
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.cpSync(src, dest, { recursive: true, force: true })
  return true
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
const context = await chromium.launchPersistentContext(profileDir, { headless: true, channel: 'chrome' })
await context.addInitScript(({ token, user }) => {
  localStorage.setItem('access_token', token)
  if (user) localStorage.setItem('greencare-admin-user', JSON.stringify(user))
}, { token: auth.token, user: auth.user })

const page = context.pages()[0] ?? (await context.newPage())
await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' })

const debug = await page.evaluate(async (reportId) => {
  const req = indexedDB.open('greencare-map-reports', 2)
  const db = await new Promise((res, rej) => {
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
  const stores = [...db.objectStoreNames]
  const pdf = await new Promise((res) => {
    const tx = db.transaction('pdfs', 'readonly')
    tx.objectStore('pdfs').get(reportId).onsuccess = (e) => res(e.target.result)
  })
  const img = await new Promise((res) => {
    const tx = db.transaction('images', 'readonly')
    tx.objectStore('images').get(reportId).onsuccess = (e) => res(e.target.result)
  })
  const raw = localStorage.getItem('greencare-map-work-reports')
  const parsed = raw ? JSON.parse(raw) : null
  const reports = Array.isArray(parsed?.state?.reports) ? parsed.state.reports : []
  db.close()
  return {
    stores,
    pdfType: pdf ? Object.prototype.toString.call(pdf) : null,
    pdfSize: pdf instanceof ArrayBuffer ? pdf.byteLength : pdf instanceof Blob ? pdf.size : null,
    imgType: img ? typeof img : null,
    imgLen: typeof img === 'string' ? img.length : null,
    reportCount: reports.length,
    hasReport: reports.some((r) => r.id === reportId),
  }
}, REPORT_ID)

console.log(JSON.stringify(debug, null, 2))
await context.close()
