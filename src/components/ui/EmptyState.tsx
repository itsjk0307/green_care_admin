import type { ReactNode } from 'react'
import { Button } from './Button'

type Props = {
  icon: ReactNode
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#E5E7EB] bg-white px-8 py-16 text-center">
      <div className="mb-4 text-[#9CA3AF]">{icon}</div>
      <h3 className="text-[15px] font-semibold text-[#111827]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-[#6B7280]">{description}</p>
      {actionLabel && onAction ? (
        <Button className="mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
