import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { ApiError } from '../../api/client'
import { exportJournal } from '../../services/journalService'
import { todayLocalDate } from '../../lib/formatScanDate'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

type Props = {
  open: boolean
  courseId: string
  onClose: () => void
}

const inputClass =
  'h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#1B5E20]'

export function ExcelExportModal({ open, courseId, onClose }: Props) {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return todayLocalDate().slice(0, 8) + '01'
  })
  const [toDate, setToDate] = useState(todayLocalDate())

  const downloadMutation = useMutation({
    mutationFn: () => exportJournal(courseId, fromDate, toDate),
    onSuccess: () => {
      toast.success('다운로드 완료', { className: 'gc-toast-success' })
      onClose()
    },
    onError: (err) => {
      const message =
        err instanceof ApiError ? err.message : '다운로드에 실패했습니다.'
      toast.error(message, { className: 'gc-toast-error' })
    },
  })

  return (
    <Modal open={open} onClose={onClose} title="Excel 다운로드">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          downloadMutation.mutate()
        }}
      >
        <div>
          <label htmlFor="export-from" className="mb-1.5 block text-sm font-bold text-[#374151]">
            시작일
          </label>
          <input
            id="export-from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label htmlFor="export-to" className="mb-1.5 block text-sm font-bold text-[#374151]">
            종료일
          </label>
          <input
            id="export-to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" loading={downloadMutation.isPending}>
            다운로드
          </Button>
        </div>
      </form>
    </Modal>
  )
}
