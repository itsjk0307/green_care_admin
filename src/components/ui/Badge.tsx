import type { HTMLAttributes } from 'react'

export type BadgeVariant =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'disease'
  | 'healthy'
  | 'info'

const styles: Record<BadgeVariant, string> = {
  pending:
    'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]',
  approved:
    'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]',
  rejected:
    'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]',
  disease:
    'bg-[#FFF7ED] text-[#EA580C] border border-[#FDBA74]',
  healthy:
    'bg-[#F0FDF4] text-[#10B981] border border-[#BBF7D0]',
  info: 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]',
}

type Props = HTMLAttributes<HTMLSpanElement> & {
  variant: BadgeVariant
}

export function Badge({ variant, className = '', children, ...rest }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  )
}
