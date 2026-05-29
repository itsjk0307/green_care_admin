type Props = {
  message?: string
}

export function LoadingSpinner({ message }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div
        className="h-9 w-9 animate-spin rounded-full border-[3px] border-slate-200 border-t-emerald-600"
        aria-hidden
      />
      {message ? (
        <p className="text-sm text-slate-500">{message}</p>
      ) : null}
    </div>
  )
}
