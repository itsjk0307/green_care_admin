import { chromium } from 'playwright'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const NEW_PDF = path.join(os.tmpdir(), 'yangji-pine-compression-check.pdf')
const OUT_DIR = path.join(os.tmpdir(), 'yangji-pdf-spotcheck')
fs.mkdirSync(OUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const page = await browser.newPage()
await page.goto(`file:///${NEW_PDF.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

// Chrome built-in PDF viewer: capture full page render
const shot = path.join(OUT_DIR, 'new-pdf-viewer.png')
await page.screenshot({ path: shot, fullPage: true })

const meta = await page.evaluate(() => ({
  title: document.title,
  bodyText: document.body?.innerText?.slice(0, 500) ?? '',
}))
console.log(JSON.stringify({ screenshot: shot, meta }, null, 2))
await browser.close()
