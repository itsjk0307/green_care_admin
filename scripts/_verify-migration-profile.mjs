/** Verify using post-migration Playwright profile (has valid session + synced meta). */
import { chromium } from 'playwright'
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

const profileDir = path.join(os.tmpdir(), 'gc-pw-migrate-profile')
if (!fs.existsSync(profileDir)) {
  console.error('Run run-map-report-migration.mjs first')
  process.exit(1)
}

const context = await chromium.launchPersistentContext(profileDir, {
  headless: true,
  channel: 'chrome',
})
const page = context.pages()[0] ?? (await context.newPage())
await page.goto(`${ORIGIN}/report-history`, { waitUntil: 'networkidle', timeout: 180000 })

const report = await page.evaluate(async ({ localIds, limit }) => {
  const { getMapReports } = await import('/src/services/mapReportService.ts')
  const { useMapReportStore } = await import('/src/stores/mapReportStore.ts')
  await useMapReportStore.getState().fetchReports(undefined, (id) => id)
  const dry = await useMapReportStore.getState().runMigrationDryRun()
  const { reports } = await getMapReports()
  const byClient = new Map(reports.map((r) => [r.client_id, r]))

  const migrated = []
  for (const cid of localIds) {
    const rec = byClient.get(cid)
    if (!rec) {
      migrated.push({ client_id: cid, found: false })
      continue
    }
    const origin = window.location.origin
    const pdfUrl = rec.pdf_url?.startsWith('http') ? rec.pdf_url : `${origin}${rec.pdf_url}`
    const imgUrl = rec.map_image_url?.startsWith('http')
      ? rec.map_image_url
      : `${origin}${rec.map_image_url}`
    const pdfHead = await fetch(pdfUrl, { method: 'HEAD' })
    const imgHead = await fetch(imgUrl, { method: 'HEAD' })
    const pdfBytes = Number(pdfHead.headers.get('content-length') || 0)
    migrated.push({
      client_id: cid,
      found: true,
      server_id: rec.id,
      work_date: rec.work_date,
      pdf_bytes: pdfBytes,
      pdf_mb: +(pdfBytes / (1024 * 1024)).toFixed(2),
      under_20mb: pdfBytes > 0 && pdfBytes <= limit,
      pdf_ok: pdfHead.ok,
      image_ok: imgHead.ok,
    })
  }

  const mobile = reports.filter((r) =>
    /oak|오크|midas|마이다스|이천/i.test(JSON.stringify(r)),
  )

  const courses = await (async () => {
    try {
      const { fetchCourses } = await import('/src/api/courses.ts')
      return await fetchCourses()
    } catch {
      return []
    }
  })()
  const courseName = (id) => courses.find((c) => c.id === id)?.name ?? id

  return {
    total_server_reports: reports.length,
    migrated_found: migrated.filter((m) => m.found).length,
    migrated_missing: migrated.filter((m) => !m.found).map((m) => m.client_id),
    migrated,
    all_under_20mb: migrated.filter((m) => m.found).every((m) => m.under_20mb),
    all_urls_ok: migrated.filter((m) => m.found).every((m) => m.pdf_ok && m.image_ok),
    migration_dry_run_count: dry.length,
    local_only_count: useMapReportStore
      .getState()
      .reports.filter((r) => !r.serverId).length,
    mobile_records: mobile.map((r) => ({
      client_id: r.client_id,
      server_id: r.id,
      work_date: r.work_date,
      course_id: r.course_id,
      course_name: courseName(r.course_id),
      pdf_url: r.pdf_url,
      map_image_url: r.map_image_url,
    })),
  }
}, { localIds: LOCAL_IDS, limit: LIMIT })

const banner = page.locator('text=Local PDF migration pending').or(
  page.locator('text=로컬 PDF 마이그레이션'),
)
report.banner_in_dom = (await banner.count()) > 0
console.log(JSON.stringify(report, null, 2))
await context.close()
