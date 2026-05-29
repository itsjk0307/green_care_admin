import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

export function CalibrationModal({ onConfirm, onCancel }) {
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')

  function handleConfirm() {
    const parsedLat = parseFloat(lat)
    const parsedLng = parseFloat(lng)
    if (isNaN(parsedLat) || isNaN(parsedLng)) return
    onConfirm({ lat: parsedLat, lng: parsedLng })
  }

  function handleKey(e) {
    if (e.key === 'Enter') handleConfirm()
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
      onKeyDown={handleKey}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">GPS 좌표 입력</h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-5 text-sm text-slate-500">
          클릭한 위치의 실제 GPS 좌표를 입력하세요
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              위도 (Latitude)
            </label>
            <input
              type="number"
              step="0.000001"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="예: 37.123456"
              autoFocus
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              경도 (Longitude)
            </label>
            <input
              type="number"
              step="0.000001"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="예: 127.123456"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          예: 위도 37.123456, 경도 127.123456
        </p>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!lat || !lng}
            className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
