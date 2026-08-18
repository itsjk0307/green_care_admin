import { apiRequest } from './client'

export type SecretaryRole = 'user' | 'assistant'

export type SecretaryMessage = {
  role: SecretaryRole
  content: string
}

export type SecretaryReply = {
  reply: string
  provider_used: string
}

export function callSecretary(
  message: string,
  history: SecretaryMessage[],
): Promise<SecretaryReply> {
  return apiRequest<SecretaryReply>('/ai/secretary', {
    method: 'POST',
    body: JSON.stringify({ message, history }),
  })
}
