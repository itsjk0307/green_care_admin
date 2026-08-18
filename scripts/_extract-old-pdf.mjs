import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const REPORT_ID = 'b1ce2491-29dc-48b5-9b86-c977e65b61e1'
const OUT = path.join(os.tmpdir(), 'yangji-pine-old.pdf')
const chromeDefault = path.join(os.homedir(), 'AppData/Local/Google/Chrome/User Data/Default')
const profileDir = path.join(os.tmpdir(), 'gc-pw-oldpdf')

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.cpSync(src, dest, { recursive: true, force: true })
}

if (fs.existsSync(profileDir)) fs.rmSync(profileDir, { recursive: true, force: true })
fs.mkdirSync(path.join(profileDir, 'Default'), { recursive: true })
const idbRoot = path.join(chromeDefault, 'IndexedDB')
for (const name of fs.readdirSync(idbRoot)) {
  if (name.startsWith('http_localhost_5173')) {
    copyDir(path.join(idbRoot, name), path.join(profileDir, 'Default', 'IndexedDB', name))
  }
}

const context = await chromium.launchPersistentContext(profileDir, { headless: true, channel: 'chrome' })
const page = context.pages()[0] ?? (await context.newPage())
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })

const bytes = await page.evaluate(async (reportId) => {
  const db = await new Promise((res, rej) => {
    const req = indexedDB.open('greencare-map-reports', 2)
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
  const buf = await new Promise((res) => {
    const tx = db.transaction('pdfs', 'readonly')
    tx.objectStore('pdfs').get(reportId).onsuccess = (e) => res(e.target.result)
  })
  db.close()
  return Array.from(new Uint8Array(buf))
}, REPORT_ID)

fs.writeFileSync(OUT, Buffer.from(bytes))
console.log(JSON.stringify({ savedTo: OUT, bytes: bytes.length }, null, 2))
await context.close()
