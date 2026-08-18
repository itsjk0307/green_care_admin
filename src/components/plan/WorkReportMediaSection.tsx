import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  FilmIcon,
  PhotoIcon,
  PlayIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { ApiError } from '../../api/client'
import {
  deletePlanMedia,
  listPlanMedia,
  planMediaPreviewUrl,
  uploadPlanMedia,
} from '../../services/planMediaService'
import { useLanguageStore } from '../../stores/languageStore'
import type { PlanMediaItem } from '../../types/planMedia'
import { detectMediaType } from '../../types/planMedia'
import { Button } from '../ui/Button'
import { LoadingSpinner } from '../ui/LoadingSpinner'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime'
const MAX_IMAGE_BYTES = 50 * 1024 * 1024
const MAX_VIDEO_BYTES = 500 * 1024 * 1024

type LocalItem = {
  localId: string
  file: File
  previewUrl: string
  mediaType: 'image' | 'video'
  status: 'pending' | 'uploading' | 'error'
  error?: string
}

type Props = {
  planId: string | null
  courseId: string
  ensurePlan: () => Promise<string>
  onEngage?: () => void
  /** When false, only media uploaded in this composer session is shown (no server list). */
  includeRemoteMedia?: boolean
}

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function WorkReportMediaSection({
  planId,
  courseId,
  ensurePlan,
  onEngage,
  includeRemoteMedia = true,
}: Props) {
  const { t } = useLanguageStore()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [localItems, setLocalItems] = useState<LocalItem[]>([])
  const [sessionRemoteItems, setSessionRemoteItems] = useState<PlanMediaItem[]>([])
  const [preview, setPreview] = useState<PlanMediaItem | LocalItem | null>(null)

  const mediaQuery = useQuery({
    queryKey: ['plan-media', planId],
    queryFn: () => listPlanMedia(planId!),
    enabled: Boolean(planId) && includeRemoteMedia,
    retry: 1,
  })

  useEffect(() => {
    if (!includeRemoteMedia) {
      setSessionRemoteItems([])
    }
  }, [includeRemoteMedia, planId])

  const remoteItems = includeRemoteMedia
    ? (mediaQuery.data ?? [])
    : sessionRemoteItems

  useEffect(() => {
    return () => {
      localItems.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    }
    // only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const id = planId ?? (await ensurePlan())
      const uploaded: PlanMediaItem[] = []
      for (const file of files) {
        uploaded.push(await uploadPlanMedia(id, file))
      }
      return { planId: id, uploaded }
    },
    onSuccess: async ({ planId: id, uploaded }) => {
      toast.success(t('mediaUploadSuccess'), { className: 'gc-toast-success' })
      if (!includeRemoteMedia) {
        setSessionRemoteItems((prev) => [...prev, ...uploaded])
      } else {
        await queryClient.invalidateQueries({ queryKey: ['plan-media', id] })
      }
    },
    onError: (err) => {
      const message =
        err instanceof ApiError ? err.message : t('mediaUploadFailed')
      toast.error(message, { className: 'gc-toast-error' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (mediaId: string) => {
      if (!planId) throw new ApiError(t('mediaNeedPlan'), 400)
      return deletePlanMedia(planId, mediaId)
    },
    onSuccess: async (_data, mediaId) => {
      toast.success(t('mediaDeleted'), { className: 'gc-toast-success' })
      if (!includeRemoteMedia) {
        setSessionRemoteItems((prev) => prev.filter((m) => m.id !== mediaId))
      } else {
        await queryClient.invalidateQueries({ queryKey: ['plan-media', planId] })
      }
    },
    onError: (err) => {
      const message =
        err instanceof ApiError ? err.message : t('mediaDeleteFailed')
      toast.error(message, { className: 'gc-toast-error' })
    },
  })

  const validateFiles = useCallback(
    (files: File[]): File[] => {
      const accepted: File[] = []
      for (const file of files) {
        const isVideo = file.type.startsWith('video/')
        const isImage = file.type.startsWith('image/')
        if (!isVideo && !isImage) {
          toast.error(t('mediaInvalidType'), { className: 'gc-toast-error' })
          continue
        }
        const max = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
        if (file.size > max) {
          toast.error(
            t('mediaTooLarge', {
              name: file.name,
              max: isVideo ? '80' : '15',
            }),
            { className: 'gc-toast-error' },
          )
          continue
        }
        accepted.push(file)
      }
      return accepted
    },
    [t],
  )

  async function handleFiles(fileList: FileList | File[]) {
    if (!courseId) {
      toast.error(t('selectCourse'), { className: 'gc-toast-error' })
      return
    }
    onEngage?.()
    const files = validateFiles(Array.from(fileList))
    if (files.length === 0) return

    // Optimistic local previews while uploading
    const nextLocal: LocalItem[] = files.map((file) => ({
      localId: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      mediaType: detectMediaType(file),
      status: 'uploading',
    }))
    setLocalItems((prev) => [...nextLocal, ...prev])

    try {
      await uploadMutation.mutateAsync(files)
      setLocalItems((prev) => {
        nextLocal.forEach((item) => URL.revokeObjectURL(item.previewUrl))
        return prev.filter(
          (p) => !nextLocal.some((n) => n.localId === p.localId),
        )
      })
    } catch {
      setLocalItems((prev) =>
        prev.map((p) =>
          nextLocal.some((n) => n.localId === p.localId)
            ? { ...p, status: 'error', error: t('mediaUploadFailed') }
            : p,
        ),
      )
    }
  }

  function removeLocal(localId: string) {
    setLocalItems((prev) => {
      const target = prev.find((p) => p.localId === localId)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((p) => p.localId !== localId)
    })
  }

  const isBusy = uploadMutation.isPending

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5 md:p-6">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-base font-semibold text-slate-900">
            {t('mediaTitle')}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">{t('mediaHint')}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<PhotoIcon className="h-4 w-4" />}
          disabled={!courseId || isBusy}
          onClick={() => inputRef.current?.click()}
          className="w-full sm:w-auto"
        >
          {t('mediaAdd')}
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void handleFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <div
        onDragEnter={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files)
        }}
        onClick={() => !isBusy && courseId && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-3 py-6 text-center transition-colors sm:px-4 sm:py-8 ${
          dragging
            ? 'border-[#121820] bg-[#f4f5f7]'
            : 'border-slate-200 bg-slate-50/60 hover:border-[#121820]/40 hover:bg-[#f4f5f7]'
        } ${!courseId || isBusy ? 'pointer-events-none opacity-60' : ''}`}
      >
        <div className="mb-2 flex gap-2 text-[#121820]">
          <PhotoIcon className="h-7 w-7" />
          <FilmIcon className="h-7 w-7" />
        </div>
        <p className="text-sm font-medium text-slate-700">{t('mediaDrop')}</p>
        <p className="mt-1 text-xs text-slate-400">{t('mediaLimits')}</p>
      </div>

      {mediaQuery.isLoading && planId && includeRemoteMedia ? (
        <div className="mt-4">
          <LoadingSpinner message={t('mediaLoading')} />
        </div>
      ) : null}

      {localItems.length > 0 || remoteItems.length > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
          {localItems.map((item) => (
            <li
              key={item.localId}
              className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
            >
              <button
                type="button"
                className="block aspect-[4/3] w-full overflow-hidden"
                onClick={() => setPreview(item)}
              >
                {item.mediaType === 'video' ? (
                  <div className="relative h-full w-full bg-slate-800">
                    <video
                      src={item.previewUrl}
                      className="h-full w-full object-cover opacity-80"
                      muted
                    />
                    <PlayIcon className="absolute inset-0 m-auto h-10 w-10 text-white drop-shadow" />
                  </div>
                ) : (
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </button>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                <p className="truncate text-[11px] text-white">
                  {item.status === 'uploading'
                    ? t('mediaUploading')
                    : item.error ?? item.file.name}
                </p>
                <p className="text-[10px] text-white/70">
                  {formatBytes(item.file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeLocal(item.localId)}
                className="absolute right-1.5 top-1.5 rounded-lg bg-black/50 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
                aria-label={t('mediaRemove')}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}

          {remoteItems.map((item) => {
            const url = planMediaPreviewUrl(item)
            const isVideo = item.media_type === 'video'
            return (
              <li
                key={item.id}
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
              >
                <button
                  type="button"
                  className="block aspect-[4/3] w-full overflow-hidden"
                  onClick={() => setPreview(item)}
                >
                  {isVideo ? (
                    <div className="relative flex h-full w-full items-center justify-center bg-slate-800">
                      {url ? (
                        <video
                          src={url}
                          className="h-full w-full object-cover opacity-80"
                          muted
                        />
                      ) : null}
                      <PlayIcon className="absolute h-10 w-10 text-white drop-shadow" />
                    </div>
                  ) : (
                    <img
                      src={url}
                      alt={item.file_name ?? ''}
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                  <p className="truncate text-[11px] text-white">
                    {item.file_name ?? (isVideo ? t('mediaVideo') : t('mediaImage'))}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(item.id)}
                  className="absolute right-1.5 top-1.5 rounded-lg bg-black/50 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
                  aria-label={t('mediaRemove')}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            )
          })}
        </ul>
      ) : !mediaQuery.isLoading ? (
        <p className="mt-4 text-center text-xs text-slate-400">
          {t('mediaEmpty')}
        </p>
      ) : null}

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-xl bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setPreview(null)}
            aria-label="Close"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
          <div
            className="max-h-[85vh] max-w-4xl overflow-hidden rounded-2xl bg-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {'previewUrl' in preview ? (
              preview.mediaType === 'video' ? (
                <video
                  src={preview.previewUrl}
                  controls
                  autoPlay
                  className="max-h-[85vh] max-w-full"
                />
              ) : (
                <img
                  src={preview.previewUrl}
                  alt=""
                  className="max-h-[85vh] max-w-full object-contain"
                />
              )
            ) : preview.media_type === 'video' ? (
              <video
                src={planMediaPreviewUrl(preview)}
                controls
                autoPlay
                className="max-h-[85vh] max-w-full"
              />
            ) : (
              <img
                src={planMediaPreviewUrl(preview)}
                alt={preview.file_name ?? ''}
                className="max-h-[85vh] max-w-full object-contain"
              />
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
