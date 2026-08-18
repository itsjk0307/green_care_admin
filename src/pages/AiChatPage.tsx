import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type SetStateAction,
} from 'react'
import {
  Image as ImageIcon,
  PanelRight,
  PanelRightOpen,
  Pencil,
  Plus,
  RefreshCw,
  SendHorizontal,
  Trash2,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ApiError } from '../api/client'
import {
  detectDisease,
  type DiseaseDetectionResult,
} from '../api/diseaseDetection'
import {
  createAiChatThread,
  deleteAiChatThread,
  generateAiChatTitle,
  listAiChatThreads,
  syncAiChatThread,
  uploadAiChatImage,
  type AiChatMessageDto,
  type AiChatThreadDto,
} from '../api/aiChat'
import { callSecretary, type SecretaryMessage } from '../api/secretary'
import { AiSparkleIcon } from '../components/icons/AiSparkleIcon'
import { AiThinkingIndicator } from '../components/ai/AiThinkingIndicator'
import { apiOrigin } from '../config'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { formatFileSize } from '../lib/formatScanDate'
import { devTerminalLog } from '../lib/devLog'
import { useLanguageStore } from '../stores/languageStore'
import type { TranslationKey } from '../i18n/translations'

type Role = 'user' | 'assistant'

type ChatMessage = {
  id: string
  role: Role
  text: string
  imageUrl?: string
  imageFile?: File
  detection?: DiseaseDetectionResult
}

type ChatThread = {
  id: string
  title: string
  updatedAt: string
  messages: ChatMessage[]
}

const MAX_HISTORY_TURNS = 12
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
const HISTORY_WIDTH = 280

function welcomeMessage(text: string): ChatMessage {
  return { id: 'welcome', role: 'assistant', text }
}

/** Browser-usable URL for a stored chat image path. */
function resolveChatImageUrl(path?: string | null): string | undefined {
  if (!path?.trim()) return undefined
  const value = path.trim()
  if (
    value.startsWith('blob:') ||
    value.startsWith('data:') ||
    value.startsWith('http://') ||
    value.startsWith('https://')
  ) {
    return value
  }
  const origin = apiOrigin()
  const normalized = value.startsWith('/') ? value : `/${value}`
  return origin ? `${origin}${normalized}` : normalized
}

/** Path to persist in chat history (never blob/data previews). */
function toStoredImageUrl(url?: string): string | undefined {
  if (!url?.trim()) return undefined
  const value = url.trim()
  if (value.startsWith('blob:') || value.startsWith('data:')) return undefined
  const origin = apiOrigin()
  if (origin && value.startsWith(origin)) {
    const stripped = value.slice(origin.length)
    return stripped.startsWith('/') ? stripped : `/${stripped}`
  }
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      return new URL(value).pathname
    } catch {
      return undefined
    }
  }
  return value.startsWith('/') ? value : `/${value}`
}

function toMessageDto(message: ChatMessage): AiChatMessageDto {
  return {
    id: message.id,
    role: message.role,
    text: message.text,
    detection: message.detection,
    image_url: toStoredImageUrl(message.imageUrl) ?? null,
    created_at: undefined,
  }
}

function fromMessageDto(message: AiChatMessageDto): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    text: message.text,
    detection: message.detection,
    imageUrl: resolveChatImageUrl(message.image_url),
  }
}

function fromThreadDto(thread: AiChatThreadDto, welcome: string): ChatThread {
  return {
    id: thread.id,
    title: thread.title,
    updatedAt: thread.updated_at,
    messages:
      thread.messages.length > 0
        ? thread.messages.map(fromMessageDto)
        : [welcomeMessage(welcome)],
  }
}

function threadSyncPayload(chat: ChatThread) {
  return {
    title: chat.title,
    messages: chat.messages.filter((m) => m.id !== 'welcome').map(toMessageDto),
  }
}

function toSecretaryHistory(messages: ChatMessage[]): SecretaryMessage[] {
  const usable = messages.filter((m) => m.id !== 'welcome' && m.text.trim())
  return usable.slice(-MAX_HISTORY_TURNS).map((m) => ({
    role: m.role,
    content: m.text.trim(),
  }))
}

function formatConfidence(value: number): string {
  const pct = value <= 1 ? value * 100 : value
  return `${Math.round(pct)}%`
}

function splitRecommendations(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  const byLine = trimmed
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*\d.)]+\s*/, '').trim())
    .filter(Boolean)
  if (byLine.length > 1) return byLine
  const bySentence = trimmed
    .split(/(?<=[.!?。])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  return bySentence.length > 1 ? bySentence : [trimmed]
}

function fillTemplate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return Object.entries(vars).reduce(
    (out, [key, value]) => out.replaceAll(`{${key}}`, String(value)),
    template,
  )
}

function downloadDetectionReport(
  result: DiseaseDetectionResult,
  language: 'ko' | 'en',
): void {
  const recommendation =
    language === 'ko' ? result.recommendation_ko : result.recommendation_en
  const body = [
    'GreenCare — Disease Detection Report',
    '================================',
    `Disease: ${result.disease_type}`,
    `Confidence: ${formatConfidence(result.confidence)}`,
    `Severity: ${result.severity}`,
    `Affected area: ${result.affected_area_percent}%`,
    `Model: ${result.model_version}`,
    '',
    'Recommendation:',
    recommendation || '—',
    '',
    `Generated: ${new Date().toISOString()}`,
  ].join('\n')

  const blob = new Blob([body], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `disease-report-${result.disease_type.replace(/\s+/g, '-').toLowerCase()}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

function deriveTitle(messages: ChatMessage[], fallback: string): string {
  const firstUser = messages.find((m) => m.role === 'user' && m.text.trim())
  if (!firstUser) return fallback
  const text = firstUser.text.trim()
  return text.length > 36 ? `${text.slice(0, 36)}…` : text
}

function assistantSnippetForTitle(msg: ChatMessage | undefined): string {
  if (!msg) return ''
  if (msg.detection) {
    const d = msg.detection
    return [d.disease_type, d.severity, d.recommendation_en || d.recommendation_ko]
      .filter(Boolean)
      .join(' · ')
  }
  return msg.text.trim()
}

function formatRelativeTime(
  iso: string,
  t: (key: TranslationKey) => string,
): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.max(0, Math.floor(diffMs / 60_000))
  if (mins < 1) return t('aiChatJustNow')
  if (mins < 60) return fillTemplate(t('aiChatMinutesAgo'), { n: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return fillTemplate(t('aiChatHoursAgo'), { n: hours })
  const days = Math.floor(hours / 24)
  return fillTemplate(t('aiChatDaysAgo'), { n: days })
}

export function AiChatPage() {
  const { language, t } = useLanguageStore()
  const breakpoint = useBreakpoint()
  const isNarrow = breakpoint === 'mobile' || breakpoint === 'tablet'

  const [chats, setChats] = useState<ChatThread[]>([])
  const [activeChatId, setActiveChatId] = useState('')
  const [loadingChats, setLoadingChats] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(() => !isNarrow)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const wasNarrow = useRef(isNarrow)
  const chatsRef = useRef(chats)
  /** Threads that already have a real AI (or user-worthy) title — don't overwrite. */
  const titledIdsRef = useRef<Set<string>>(new Set())
  const titleJobsRef = useRef<Set<string>>(new Set())

  const activeChat = chats.find((c) => c.id === activeChatId) ?? chats[0]
  const messages = activeChat?.messages ?? []

  useEffect(() => {
    chatsRef.current = chats
  }, [chats])

  function isUntitled(title: string) {
    const trimmed = title.trim()
    return !trimmed || trimmed === t('aiChatNewChat')
  }

  async function requestAiTitle(
    chatId: string,
    userText: string,
    assistantText: string,
  ) {
    if (!userText.trim()) return
    if (titledIdsRef.current.has(chatId) || titleJobsRef.current.has(chatId)) return
    titleJobsRef.current.add(chatId)
    try {
      const { title } = await generateAiChatTitle({
        user_message: userText.trim(),
        assistant_message: assistantText.trim() || undefined,
        language,
      })
      const next = title.trim()
      if (!next || isUntitled(next)) return
      titledIdsRef.current.add(chatId)
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? { ...chat, title: next, updatedAt: new Date().toISOString() }
            : chat,
        ),
      )
      const chat = chatsRef.current.find((c) => c.id === chatId)
      if (chat) {
        void syncAiChatThread(chatId, threadSyncPayload({ ...chat, title: next })).catch(
          (err) => {
            devTerminalLog('warn', 'ai chat title sync failed', {
              message: err instanceof Error ? err.message : String(err),
            })
          },
        )
      }
    } catch (err) {
      devTerminalLog('warn', 'ai chat title generation failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      titleJobsRef.current.delete(chatId)
    }
  }

  useEffect(() => {
    let cancelled = false

    function isBlankChat(chat: ChatThread) {
      return (
        chat.messages.length === 0 ||
        (chat.messages.length === 1 && chat.messages[0]?.id === 'welcome')
      )
    }

    async function loadChats() {
      setLoadingChats(true)
      const welcome = t('aiChatWelcome')
      try {
        const { threads } = await listAiChatThreads()
        if (cancelled) return

        let next = threads.map((thread) => fromThreadDto(thread, welcome))

        // Entering the AI page always starts a fresh chat (history stays in sidebar).
        const blank = next.find(isBlankChat)
        if (blank) {
          next = [blank, ...next.filter((chat) => chat.id !== blank.id)]
        } else {
          const created = await createAiChatThread({
            title: t('aiChatNewChat'),
            messages: [],
          })
          if (cancelled) return
          next = [fromThreadDto(created, welcome), ...next]
        }

        setChats(next)
        setActiveChatId(next[0].id)
        setInput('')
        setImageFile(null)
        setEditingId(null)
        setSending(false)
        const known = new Set<string>()
        for (const chat of next) {
          if (!isBlankChat(chat) && chat.title.trim() && chat.title.trim() !== t('aiChatNewChat')) {
            known.add(chat.id)
          }
        }
        titledIdsRef.current = known
        titleJobsRef.current = new Set()
      } catch (err) {
        if (cancelled) return
        devTerminalLog('warn', 'ai chat history load failed', {
          message: err instanceof Error ? err.message : String(err),
        })
        const fallbackId = crypto.randomUUID()
        setChats([
          {
            id: fallbackId,
            title: t('aiChatNewChat'),
            updatedAt: new Date().toISOString(),
            messages: [welcomeMessage(welcome)],
          },
        ])
        setActiveChatId(fallbackId)
      } finally {
        if (!cancelled) setLoadingChats(false)
      }
    }

    void loadChats()
    return () => {
      cancelled = true
    }
  }, [language, t])

  async function syncActiveChat(chatId = activeChatId, messagesOverride?: ChatMessage[]) {
    const chat = chatsRef.current.find((item) => item.id === chatId)
    if (!chat) return
    // messagesOverride lets callers pass the messages they just computed
    // instead of chatsRef, which lags one render behind React state.
    const payloadChat = messagesOverride ? { ...chat, messages: messagesOverride } : chat
    try {
      await syncAiChatThread(chatId, threadSyncPayload(payloadChat))
    } catch (err) {
      devTerminalLog('warn', 'ai chat sync failed', {
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  useEffect(() => {
    if (wasNarrow.current !== isNarrow) {
      wasNarrow.current = isNarrow
      setHistoryOpen(!isNarrow)
    }
  }, [isNarrow])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending, activeChatId])

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null)
      return
    }
    const url = URL.createObjectURL(imageFile)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  function updateActiveMessages(
    updater: SetStateAction<ChatMessage[]>,
    touchTitle = true,
  ) {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== activeChatId) return chat
        const nextMessages =
          typeof updater === 'function' ? updater(chat.messages) : updater
        const keepTitle =
          !touchTitle ||
          titledIdsRef.current.has(chat.id) ||
          !isUntitled(chat.title)
        return {
          ...chat,
          messages: nextMessages,
          updatedAt: new Date().toISOString(),
          title: keepTitle
            ? chat.title
            : deriveTitle(nextMessages, chat.title || t('aiChatNewChat')),
        }
      }),
    )
  }

  const setMessages: Dispatch<SetStateAction<ChatMessage[]>> = (updater) => {
    updateActiveMessages(updater, true)
  }

  function clearImage() {
    setImageFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function resetComposer() {
    setInput('')
    clearImage()
    setEditingId(null)
  }

  function pickImage(file: File | null) {
    if (!file) return
    const typeOk =
      ACCEPTED_TYPES.includes(file.type) || file.type.startsWith('image/')
    if (!typeOk || file.size > MAX_IMAGE_BYTES) {
      toast.error(t('aiChatImageInvalid'), { className: 'gc-toast-error' })
      return
    }
    setImageFile(file)
  }

  function detectionErrorMessage(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 422) return t('aiChatImageInvalid')
      if (err.status === 502) return t('aiChatDetectFailed')
      if (err.status === 429) return t('aiChatQuota')
      return err.message || t('aiChatDetectFailed')
    }
    return err instanceof Error ? err.message : t('aiChatDetectFailed')
  }

  async function runDetection(file: File): Promise<ChatMessage> {
    const result = await detectDisease(file)
    devTerminalLog('info', 'disease detection ok', {
      disease_type: result.disease_type,
      model_version: result.model_version,
    })
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: '',
      detection: result,
    }
    setMessages((prev) => [...prev, message])
    return message
  }

  async function handleSend(e?: FormEvent) {
    e?.preventDefault()
    const text = input.trim()
    if (sending) return
    if (!text && !imageFile) return

    const pendingImage = imageFile
    const previewUrl = pendingImage
      ? URL.createObjectURL(pendingImage)
      : undefined

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text:
        text ||
        (language === 'ko' ? '잔디 사진 분석 요청' : 'Analyze turf photo'),
      imageUrl: previewUrl,
      imageFile: pendingImage ?? undefined,
    }

    const historySource = messages
    let baseMessages = editingId
      ? (() => {
          const idx = historySource.findIndex((m) => m.id === editingId)
          return idx < 0
            ? [...historySource, userMsg]
            : [...historySource.slice(0, idx), userMsg]
        })()
      : [...historySource, userMsg]

    setMessages(() => baseMessages)
    if (editingId) setEditingId(null)

    setInput('')
    clearImage()
    setSending(true)

    // Track the fully-settled message list ourselves rather than reading it
    // back from React state right after — chatsRef only updates a render
    // later, so syncActiveChat would sync a stale list missing the AI reply.
    let finalMessages = baseMessages
    let succeeded = false

    try {
      if (pendingImage) {
        try {
          const uploaded = await uploadAiChatImage(pendingImage)
          const durableUrl = resolveChatImageUrl(uploaded.image_url)
          if (durableUrl) {
            if (previewUrl) URL.revokeObjectURL(previewUrl)
            baseMessages = baseMessages.map((m) =>
              m.id === userMsg.id
                ? { ...m, imageUrl: durableUrl, imageFile: pendingImage }
                : m,
            )
            setMessages(() => baseMessages)
          }
        } catch (uploadErr) {
          devTerminalLog('warn', 'ai chat image upload failed — preview only', {
            message:
              uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
          })
        }

        const detectionMsg = await runDetection(pendingImage)
        finalMessages = [...baseMessages, detectionMsg]
        succeeded = true
        return
      }

      const { reply, provider_used } = await callSecretary(
        text,
        toSecretaryHistory(historySource),
      )
      devTerminalLog(
        'info',
        `secretary reply served by provider=${provider_used}`,
      )
      finalMessages = [
        ...baseMessages,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: reply || t('aiChatError'),
        },
      ]
      setMessages(() => finalMessages)
      succeeded = true
    } catch (err) {
      const friendly = pendingImage
        ? detectionErrorMessage(err)
        : err instanceof ApiError && err.status === 429
          ? t('aiChatQuota')
          : err instanceof Error
            ? err.message
            : t('aiChatError')
      toast.error(friendly, { className: 'gc-toast-error' })
      finalMessages = [
        ...baseMessages,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: friendly,
        },
      ]
      setMessages(() => finalMessages)
    } finally {
      setSending(false)
      inputRef.current?.focus()
      void syncActiveChat(activeChatId, finalMessages)
      if (succeeded) {
        const lastAssistant = [...finalMessages]
          .reverse()
          .find((m) => m.role === 'assistant' && m.id !== 'welcome')
        void requestAiTitle(
          activeChatId,
          userMsg.text,
          assistantSnippetForTitle(lastAssistant),
        )
      }
    }
  }

  function handleEdit(msg: ChatMessage) {
    if (sending) return
    setEditingId(msg.id)
    setInput(msg.text)
    if (msg.imageFile) setImageFile(msg.imageFile)
    inputRef.current?.focus()
  }

  async function fileFromChatImage(msg: ChatMessage): Promise<File | null> {
    if (msg.imageFile) return msg.imageFile
    if (!msg.imageUrl || msg.imageUrl.startsWith('blob:')) return null
    try {
      const response = await fetch(msg.imageUrl)
      if (!response.ok) return null
      const blob = await response.blob()
      const type = blob.type || 'image/jpeg'
      const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'
      return new File([blob], `chat-image.${ext}`, { type })
    } catch {
      return null
    }
  }

  async function handleResubmit(msg: ChatMessage) {
    if (sending) return
    const file = await fileFromChatImage(msg)
    if (!file) {
      toast.error(t('aiChatImageInvalid'), { className: 'gc-toast-error' })
      return
    }
    setSending(true)
    const idx = messages.findIndex((m) => m.id === msg.id)
    const baseMessages = idx < 0 ? messages : messages.slice(0, idx + 1)
    setMessages(() => baseMessages)
    let finalMessages = baseMessages
    try {
      const detectionMsg = await runDetection(file)
      finalMessages = [...baseMessages, detectionMsg]
    } catch (err) {
      const friendly = detectionErrorMessage(err)
      toast.error(friendly, { className: 'gc-toast-error' })
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: friendly,
      }
      setMessages(() => [...baseMessages, errorMsg])
      finalMessages = [...baseMessages, errorMsg]
    } finally {
      setSending(false)
      void syncActiveChat(activeChatId, finalMessages)
    }
  }

  function handleSelectChat(id: string) {
    if (id === activeChatId) {
      if (isNarrow) setHistoryOpen(false)
      return
    }
    setActiveChatId(id)
    resetComposer()
    setSending(false)
    if (isNarrow) setHistoryOpen(false)
  }

  function handleNewChat() {
    void (async () => {
      try {
        const created = await createAiChatThread({
          title: t('aiChatNewChat'),
          messages: [],
        })
        const thread = fromThreadDto(created, t('aiChatWelcome'))
        setChats((prev) => [thread, ...prev])
        setActiveChatId(thread.id)
        resetComposer()
        setSending(false)
        if (isNarrow) setHistoryOpen(false)
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : t('aiChatError'),
          { className: 'gc-toast-error' },
        )
      }
    })()
  }

  function handleDeleteChat(id: string) {
    if (!window.confirm(t('aiChatDeleteChatConfirm'))) return
    void (async () => {
      try {
        await deleteAiChatThread(id)
      } catch {
        /* still remove locally when offline */
      }

      const remaining = chatsRef.current.filter((c) => c.id !== id)
      if (remaining.length === 0) {
        try {
          const created = await createAiChatThread({
            title: t('aiChatNewChat'),
            messages: [],
          })
          const fresh = fromThreadDto(created, t('aiChatWelcome'))
          setChats([fresh])
          setActiveChatId(fresh.id)
        } catch {
          const freshId = crypto.randomUUID()
          const fresh: ChatThread = {
            id: freshId,
            title: t('aiChatNewChat'),
            updatedAt: new Date().toISOString(),
            messages: [welcomeMessage(t('aiChatWelcome'))],
          }
          setChats([fresh])
          setActiveChatId(freshId)
        }
        resetComposer()
        return
      }

      setChats(remaining)
      if (id === activeChatId) {
        setActiveChatId(remaining[0].id)
        resetComposer()
      }
    })()
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const canSend = (Boolean(input.trim()) || Boolean(imageFile)) && !sending
  const isDetecting = sending && Boolean(messages[messages.length - 1]?.imageUrl)
  const sortedChats = [...chats].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
  const showDockedHistory = historyOpen && !isNarrow
  const showOverlayHistory = historyOpen && isNarrow

  return (
    <div className="page-enter relative -m-3 flex h-[calc(100dvh-60px)] sm:-m-5 sm:h-[calc(100dvh-68px)] md:-m-6 xl:-m-8">
      {/* Chat column — keep page padding on this side only */}
      <div className="relative mx-auto flex min-h-0 min-w-0 flex-1 flex-col p-3 sm:p-5 md:p-6 xl:p-8">
        {/* Gemini-style open control — only when history is closed */}
        {!historyOpen ? (
          <div className="group absolute right-2 top-2 z-20 sm:right-3 sm:top-3">
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-[#2b2d31] hover:text-white"
              aria-label={t('aiChatHistoryOpen')}
              aria-expanded={false}
            >
              <PanelRightOpen className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute right-full top-1/2 z-30 mr-2 -translate-y-1/2 whitespace-nowrap rounded-full bg-[#e8eaed] px-3 py-1.5 text-[12px] font-medium text-[#3c4043] opacity-0 shadow-sm transition group-hover:opacity-100"
            >
              {t('aiChatHistoryOpen')}
            </span>
          </div>
        ) : null}

        <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col">
          <div
            className={`min-h-0 flex-1 space-y-5 overflow-y-auto px-1 pb-4 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:space-y-6 sm:px-2 ${
              messages.length === 1 && messages[0]?.id === 'welcome'
                ? 'flex flex-col justify-center'
                : ''
            }`}
          >
            {messages.map((m) => {
              if (m.role === 'assistant' && m.detection) {
                return (
                  <DetectionCard
                    key={m.id}
                    result={m.detection}
                    language={language}
                    t={t}
                    onDownload={() => {
                      downloadDetectionReport(m.detection!, language)
                      toast.success(t('aiChatReportSaved'), {
                        className: 'gc-toast-success',
                      })
                    }}
                  />
                )
              }

              if (m.role === 'assistant' && m.id === 'welcome') {
                return (
                  <div
                    key={m.id}
                    className="flex flex-col items-center px-3 py-6 text-center sm:px-6 sm:py-10"
                  >
                    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#121820] shadow-[0_8px_24px_rgba(18,24,32,0.28)] ring-1 ring-white/10 sm:h-16 sm:w-16">
                      <AiSparkleIcon className="h-7 w-7 sm:h-8 sm:w-8" />
                    </div>
                    <p className="max-w-xl text-xl font-semibold leading-snug tracking-tight text-slate-800 sm:text-2xl sm:leading-snug">
                      {m.text}
                    </p>
                  </div>
                )
              }

              if (m.role === 'assistant') {
                return (
                  <div key={m.id} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#121820] shadow-sm ring-1 ring-white/10">
                      <AiSparkleIcon className="h-4 w-4" />
                    </div>
                    <div className="max-w-[min(100%,34rem)] rounded-2xl bg-white px-4 py-3.5 text-sm leading-relaxed text-slate-700 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_24px_rgba(15,23,42,0.04)] ring-1 ring-slate-100/80">
                      <p className="whitespace-pre-wrap">{m.text}</p>
                    </div>
                  </div>
                )
              }

              return (
                <UserCard
                  key={m.id}
                  msg={m}
                  disabled={sending}
                  editLabel={t('aiChatEdit')}
                  resubmitLabel={t('aiChatResubmit')}
                  onEdit={() => handleEdit(m)}
                  onResubmit={() => void handleResubmit(m)}
                />
              )
            })}

            {sending ? (
              <AiThinkingIndicator
                mode={isDetecting ? 'detecting' : 'thinking'}
                t={t}
              />
            ) : null}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => void handleSend(e)}
            className="shrink-0 px-1 pb-1 pt-2 sm:px-2"
          >
            {imageFile && imagePreview ? (
              <div className="mb-2 flex items-center gap-2.5 rounded-2xl bg-white px-3 py-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
                <img
                  src={imagePreview}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {imageFile.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatFileSize(imageFile.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearImage}
                  disabled={sending}
                  aria-label={t('aiChatRemoveImage')}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            ) : null}

            <div className="flex items-end gap-1.5 rounded-2xl border border-slate-200 bg-white px-2 py-2 shadow-[0_2px_8px_rgba(15,23,42,0.05)] transition focus-within:border-brand/35 focus-within:ring-2 focus-within:ring-brand/10 sm:gap-2 sm:px-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                className="hidden"
                disabled={sending}
                onChange={(e) => {
                  pickImage(e.target.files?.[0] ?? null)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                disabled={sending}
                aria-label={t('aiChatAttachImage')}
                title={t('aiChatAttachImage')}
                onClick={() => fileInputRef.current?.click()}
                className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40"
              >
                <ImageIcon className="h-5 w-5" strokeWidth={1.75} />
              </button>
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t('aiChatImageOnlyHint')}
                className="max-h-28 min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={!canSend}
                aria-label={t('aiChatSend')}
                className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#121820] text-white shadow-sm transition hover:bg-[#1c2630] disabled:opacity-35"
              >
                <SendHorizontal className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Docked history (laptop+) — full viewport height under header */}
      {showDockedHistory ? (
        <ChatHistoryPanel
          chats={sortedChats}
          activeChatId={activeChat?.id ?? ''}
          onSelect={handleSelectChat}
          onNew={handleNewChat}
          onDelete={handleDeleteChat}
          onClose={() => setHistoryOpen(false)}
          t={t}
          className="h-full rounded-none border-l border-slate-200/80"
        />
      ) : null}

      {/* Overlay history (tablet/mobile) */}
      {showOverlayHistory ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-900/35 backdrop-blur-[1px]"
            aria-label={t('aiChatHistoryClose')}
            onClick={() => setHistoryOpen(false)}
          />
          <div className="fixed bottom-0 right-0 top-[60px] z-50 flex w-[min(300px,88vw)] flex-col sm:top-[68px]">
            <ChatHistoryPanel
              chats={sortedChats}
              activeChatId={activeChat?.id ?? ''}
              onSelect={handleSelectChat}
              onNew={handleNewChat}
              onDelete={handleDeleteChat}
              onClose={() => setHistoryOpen(false)}
              t={t}
              className="h-full rounded-l-2xl border-l border-slate-200/80 shadow-[var(--shadow-gc-modal)]"
            />
          </div>
        </>
      ) : null}
    </div>
  )
}

function ChatHistoryPanel({
  chats,
  activeChatId,
  onSelect,
  onNew,
  onDelete,
  onClose,
  t,
  className = '',
}: {
  chats: ChatThread[]
  activeChatId: string
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onClose: () => void
  t: (key: TranslationKey) => string
  className?: string
}) {
  return (
    <aside
      className={`flex h-full shrink-0 flex-col overflow-hidden bg-white ${className}`}
      style={{ width: HISTORY_WIDTH }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
        <p className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {t('aiChatHistory')}
        </p>
        <div className="group relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-[#2b2d31] hover:text-white"
            title={t('aiChatHistoryClose')}
            aria-label={t('aiChatHistoryClose')}
          >
            <PanelRight className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <span
            role="tooltip"
            className="pointer-events-none absolute right-full top-1/2 z-30 mr-2 -translate-y-1/2 whitespace-nowrap rounded-full bg-[#e8eaed] px-3 py-1.5 text-[12px] font-medium text-[#3c4043] opacity-0 shadow-sm transition group-hover:opacity-100"
          >
            {t('aiChatHistoryClose')}
          </span>
        </div>
      </div>

      <div className="border-b border-slate-100 p-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#121820] px-3 py-2.5 text-sm font-medium text-white transition hover:bg-[#1c2630]"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          {t('aiChatNewChat')}
        </button>
      </div>

      <ul className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {chats.length === 0 ? (
          <li className="px-3 py-8 text-center text-sm text-slate-400">
            {t('aiChatHistoryEmpty')}
          </li>
        ) : (
          chats.map((chat) => {
            const active = chat.id === activeChatId
            return (
              <li key={chat.id}>
                <div
                  className={`group relative flex items-start gap-1 rounded-xl transition ${
                    active
                      ? 'bg-slate-100/90'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  {active ? (
                    <span
                      className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[#121820]"
                      aria-hidden
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onSelect(chat.id)}
                    className="min-w-0 flex-1 px-3 py-2.5 text-left"
                  >
                    <p
                      className={`truncate text-[13px] ${
                        active
                          ? 'font-semibold text-slate-900'
                          : 'font-medium text-slate-700'
                      }`}
                    >
                      {chat.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {formatRelativeTime(chat.updatedAt, t)}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(chat.id)}
                    className="mr-1.5 mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 focus:opacity-100"
                    title={t('aiChatDeleteChat')}
                    aria-label={t('aiChatDeleteChat')}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
              </li>
            )
          })
        )}
      </ul>
    </aside>
  )
}

function UserCard({
  msg,
  disabled,
  editLabel,
  resubmitLabel,
  onEdit,
  onResubmit,
}: {
  msg: ChatMessage
  disabled: boolean
  editLabel: string
  resubmitLabel: string
  onEdit: () => void
  onResubmit: () => void
}) {
  return (
    <div className="flex justify-end">
      <div className="w-full max-w-[min(100%,22rem)] overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_24px_rgba(15,23,42,0.04)] ring-1 ring-slate-100/80 sm:max-w-sm">
        {msg.imageUrl ? (
          <img
            src={msg.imageUrl}
            alt=""
            className="aspect-[4/3] w-full object-cover"
          />
        ) : null}
        <div className="px-4 py-3">
          <p className="text-sm leading-relaxed text-slate-700">{msg.text}</p>
          {msg.imageUrl ? (
            <div className="mt-3 flex items-center justify-end gap-3 border-t border-slate-100 pt-2.5">
              <button
                type="button"
                disabled={disabled}
                onClick={onEdit}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-slate-700 disabled:opacity-40"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                {editLabel}
              </button>
              {msg.imageUrl ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onResubmit}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-slate-700 disabled:opacity-40"
                >
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
                  {resubmitLabel}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function DetectionCard({
  result,
  language,
  t,
  onDownload,
}: {
  result: DiseaseDetectionResult
  language: 'ko' | 'en'
  t: (key: TranslationKey) => string
  onDownload: () => void
}) {
  const recommendation =
    language === 'ko' ? result.recommendation_ko : result.recommendation_en
  const bullets = splitRecommendations(recommendation)
  const heading = fillTemplate(t('aiChatDetectionHeading'), {
    disease: result.disease_type,
  })
  const meta = fillTemplate(t('aiChatMetaLine'), {
    confidence: formatConfidence(result.confidence),
    severity: result.severity,
    area: result.affected_area_percent,
  })

  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#121820] shadow-sm ring-1 ring-white/10">
        <AiSparkleIcon className="h-4 w-4" />
      </div>
      <div className="min-w-0 max-w-[min(100%,36rem)] flex-1 rounded-2xl bg-white px-4 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_24px_rgba(15,23,42,0.04)] ring-1 ring-slate-100/80 sm:px-5">
        <p className="text-[15px] font-semibold leading-snug tracking-tight text-slate-900">
          {heading}
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-slate-400">{meta}</p>

        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-800">
            {t('aiChatRecommendation')}:
          </p>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-600">
            {bullets.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <p className="text-[11px] text-slate-400">
            @ {result.model_version || '—'}
          </p>
          <button
            type="button"
            onClick={onDownload}
            className="text-[12px] font-semibold text-brand transition hover:text-brand-dark"
          >
            {t('aiChatDownloadReport')}
          </button>
        </div>
      </div>
    </div>
  )
}
