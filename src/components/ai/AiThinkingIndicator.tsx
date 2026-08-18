import { useEffect, useState } from 'react'

import { AiSparkleIcon } from '../icons/AiSparkleIcon'
import type { TranslationKey } from '../../i18n/translations'

type Props = {
  mode: 'thinking' | 'detecting'
  t: (key: TranslationKey) => string
}

const THINKING_KEYS: TranslationKey[] = [
  'aiChatThinking',
  'aiChatThinkingStep1',
  'aiChatThinkingStep2',
  'aiChatThinkingStep3',
  'aiChatThinkingStep4',
]

const DETECTING_KEYS: TranslationKey[] = [
  'aiChatDetecting',
  'aiChatDetectingStep1',
  'aiChatDetectingStep2',
  'aiChatDetectingStep3',
]

/**
 * Premium waiting state — quiet Claude/Gemini-style shimmer, no busy chrome.
 */
export function AiThinkingIndicator({ mode, t }: Props) {
  const keys = mode === 'detecting' ? DETECTING_KEYS : THINKING_KEYS
  const [step, setStep] = useState(0)

  useEffect(() => {
    setStep(0)
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % keys.length)
    }, 2600)
    return () => window.clearInterval(id)
  }, [keys.length, mode])

  const label = t(keys[step] ?? keys[0]!)

  return (
    <div
      className="ai-thinking flex items-start gap-3"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#121820] shadow-sm ring-1 ring-white/10">
        <AiSparkleIcon className="ai-thinking__sparkle h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1 pt-1.5">
        <p key={label} className="ai-thinking__label text-[15px] font-medium tracking-[-0.01em]">
          {label}
        </p>

        <div className="ai-thinking__draft mt-3 space-y-2" aria-hidden>
          <span className="ai-thinking__skel-line block h-2.5 w-[min(100%,18rem)] rounded-full" />
          <span className="ai-thinking__skel-line ai-thinking__skel-line--lag block h-2.5 w-[min(72%,13rem)] rounded-full" />
        </div>
      </div>
    </div>
  )
}
