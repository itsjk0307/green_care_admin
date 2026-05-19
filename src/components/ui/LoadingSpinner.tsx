type Props = {
  message?: string
}

export function LoadingSpinner({ message }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div
        className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#E5E7EB] border-t-[#1B5E20]"
        aria-hidden
      />
      {message ? (
        <p className="text-sm text-[#6B7280]">{message}</p>
      ) : null}
    </div>
  )
}
