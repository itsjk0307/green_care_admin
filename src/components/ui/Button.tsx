import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const variantClass: Record<Variant, string> = {
  primary:
    'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-sm',
  secondary:
    'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
  danger:
    'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100',
  ghost:
    'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700',
}

const sizeClass: Record<Size, string> = {
  sm: 'h-9 px-4 text-[13px] rounded-xl',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-11 px-5 text-sm rounded-xl',
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
      className={`inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 ease-out active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none ${variantClass[variant]} ${sizeClass[size]} ${className}`}
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
