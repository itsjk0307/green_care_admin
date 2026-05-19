import type { HTMLAttributes } from 'react'

type Props = HTMLAttributes<HTMLDivElement> & {
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const pad: Record<NonNullable<Props['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

export function Card({
  children,
  className = '',
  padding = 'md',
  ...rest
}: Props) {
  return (
    <div
      className={`rounded-2xl border border-[#EEEEEE] bg-white shadow-[var(--shadow-gc-card)] transition-all duration-150 ease-out ${pad[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}
