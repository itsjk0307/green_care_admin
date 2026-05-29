import type { HTMLAttributes } from 'react'

export type BadgeVariant =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'disease'
  | 'healthy'
  | 'info'

const styles: Record<BadgeVariant, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  disease: 'bg-orange-100 text-orange-700',
  healthy: 'bg-emerald-100 text-emerald-700',
  info: 'bg-blue-100 text-blue-700',
}

type Props = HTMLAttributes<HTMLSpanElement> & {
  variant: BadgeVariant
}

export function Badge({ variant, className = '', children, ...rest }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  )
}
