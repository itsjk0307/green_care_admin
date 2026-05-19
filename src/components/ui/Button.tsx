import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const variantClass: Record<Variant, string> = {
  primary:
    'bg-[#1B5E20] text-white hover:bg-[#166534] active:bg-[#14532D] shadow-sm hover:shadow',
  secondary:
    'bg-white text-[#374151] border border-[#E5E7EB] hover:bg-[#F9FAFB]',
  danger:
    'bg-white text-[#DC2626] border-[1.5px] border-[#DC2626] hover:bg-[#FEF2F2]',
  ghost:
    'bg-transparent text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#374151]',
}

const sizeClass: Record<Size, string> = {
  sm: 'h-9 px-4 text-[13px] rounded-lg',
  md: 'h-11 px-5 text-sm rounded-[10px]',
  lg: 'h-12 px-6 text-sm rounded-[10px]',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className = '',
  disabled,
  children,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 ease-out disabled:opacity-50 disabled:pointer-events-none ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon
      )}
      {children}
    </button>
  )
}
