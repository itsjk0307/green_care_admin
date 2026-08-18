import { apiRequest } from './client'
import type { DiseaseDetectionResult } from './diseaseDetection'

export type AiChatMessageDto = {
  id: string
  role: 'user' | 'assistant'
  text: string
  detection?: DiseaseDetectionResult
  /** Durable storage path, e.g. `/storage/images/ai_chat/...` */
  image_url?: string | null
  created_at?: string
}

export type AiChatThreadDto = {
  id: string
  title: string
  updated_at: string
  messages: AiChatMessageDto[]
}

export type AiChatThreadListDto = {
  threads: AiChatThreadDto[]
}

export type AiChatImageUploadDto = {
  image_url: string
}

export type AiChatTitleDto = {
  title: string
  provider_used: string
}

export const listAiChatThreads = () =>
  apiRequest<AiChatThreadListDto>('/ai/chats')

export const createAiChatThread = (payload: {
  title: string
  client_id?: string
  messages?: AiChatMessageDto[]
}) =>
  apiRequest<AiChatThreadDto>('/ai/chats', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const generateAiChatTitle = (payload: {
  user_message: string
  assistant_message?: string
  language: 'ko' | 'en'
}) =>
  apiRequest<AiChatTitleDto>('/ai/chats/title', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const syncAiChatThread = (
  threadId: string,
  payload: { title: string; messages: AiChatMessageDto[] },
) =>
  apiRequest<AiChatThreadDto>(`/ai/chats/${threadId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

export const deleteAiChatThread = (threadId: string) =>
  apiRequest<Record<string, never>>(`/ai/chats/${threadId}`, {
    method: 'DELETE',
  })

/** Persist a chat attachment so history survives refresh. */
export const uploadAiChatImage = (file: File) => {
  const formData = new FormData()
  formData.append('image', file)
  return apiRequest<AiChatImageUploadDto>('/ai/chats/images', {
    method: 'POST',
    body: formData,
  })
}
