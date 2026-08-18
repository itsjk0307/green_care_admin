import { useId } from 'react'

type Props = {
  className?: string
  title?: string
}

/**
 * Gemini-style multicolor 4-point sparkle for AI entry points.
 */
export function AiSparkleIcon({ className, title }: Props) {
  const gid = useId().replace(/:/g, '')

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient
          id={`${gid}-fill`}
          x1="3"
          y1="3"
          x2="21"
          y2="21"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#F9AB00" />
          <stop offset="28%" stopColor="#EA4335" />
          <stop offset="55%" stopColor="#A142F4" />
          <stop offset="78%" stopColor="#4285F4" />
          <stop offset="100%" stopColor="#34A853" />
        </linearGradient>
      </defs>
      <path
        d="M12 1.8c.55 3.9 2.4 6.55 5.9 7.4-3.5.85-5.35 3.5-5.9 7.4-.55-3.9-2.4-6.55-5.9-7.4 3.5-.85 5.35-3.5 5.9-7.4Z"
        fill={`url(#${gid}-fill)`}
      />
      <path
        d="M19.2 3.2c.22 1.35.78 2.2 1.95 2.5-1.17.3-1.73 1.15-1.95 2.5-.22-1.35-.78-2.2-1.95-2.5 1.17-.3 1.73-1.15 1.95-2.5Z"
        fill={`url(#${gid}-fill)`}
        opacity="0.95"
      />
    </svg>
  )
}
