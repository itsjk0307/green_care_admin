import {
  callSecretary,
  type SecretaryMessage,
} from '../api/secretary'
import {
  isLowStock,
  type InventoryItem,
} from '../stores/inventoryStore'
import type { Language } from '../i18n/translations'

export type InventoryAiChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

export type RestockSuggestion = {
  itemId: string
  itemName: string
  qty: number
  unit: string
}

export type InventoryAiResult = {
  reply: string
  displayText: string
  suggestions: RestockSuggestion[]
  provider_used: string
}

const RESTOCK_LINE =
  /^\s*RESTOCK\s*\|\s*(.+?)\s*\|\s*([0-9]+(?:\.[0-9]+)?)\s*\|\s*(.+?)\s*$/i

export function buildInventoryContext(
  items: InventoryItem[],
  courseName: string,
  language: Language,
): string {
  if (language === 'ko') {
    if (items.length === 0) {
      return `골프장: ${courseName}\n재고: 등록된 품목 없음.`
    }
    const lines = items.map((item) => {
      const low = isLowStock(item) ? ' [부족]' : ''
      const note = item.note?.trim() ? ` | 메모: ${item.note.trim()}` : ''
      return `- ${item.name}: ${item.quantity} ${item.unit} (경고 기준 ${item.lowThreshold} ${item.unit})${low}${note}`
    })
    return `골프장: ${courseName}\n현재 재고 목록:\n${lines.join('\n')}`
  }

  if (items.length === 0) {
    return `Course: ${courseName}\nInventory: no items registered.`
  }
  const lines = items.map((item) => {
    const low = isLowStock(item) ? ' [LOW]' : ''
    const note = item.note?.trim() ? ` | note: ${item.note.trim()}` : ''
    return `- ${item.name}: ${item.quantity} ${item.unit} (alert at ${item.lowThreshold} ${item.unit})${low}${note}`
  })
  return `Course: ${courseName}\nCurrent inventory:\n${lines.join('\n')}`
}

function advisorPreamble(language: Language): string {
  if (language === 'ko') {
    return [
      '당신은 GreenCare 스마트 재고 조언자입니다. 골프장 그린키핑용 시약·비료·모래·부품 재고를 돕습니다.',
      '아래 [재고 데이터]에 있는 숫자만 사용하세요. 없는 재고를 지어내지 마세요.',
      '답변은 짧고 실용적으로. 부족 품목이 있으면 우선 안내하세요.',
      '재고 보충을 제안할 때는 답변 본문 아래에 한 줄씩 정확히 이 형식으로 추가하세요 (사용자에게 설명할 필요 없음):',
      'RESTOCK|품목명|수량|단위',
      '품목명은 재고 목록의 이름과 동일해야 합니다.',
    ].join('\n')
  }
  return [
    'You are the GreenCare smart inventory advisor for golf course greenkeeping stock (chemicals, fertilizer, sand, parts).',
    'Use ONLY numbers from [INVENTORY DATA] below. Never invent stock quantities.',
    'Keep answers short and practical. Prioritize low-stock items.',
    'When suggesting a restock, append one line per item in EXACTLY this format (no explanation of the format):',
    'RESTOCK|itemName|qty|unit',
    'itemName must match an inventory item name.',
  ].join('\n')
}

export function parseRestockSuggestions(
  reply: string,
  items: InventoryItem[],
): RestockSuggestion[] {
  const byName = new Map(
    items.map((item) => [item.name.trim().toLowerCase(), item]),
  )
  const out: RestockSuggestion[] = []
  const seen = new Set<string>()

  for (const rawLine of reply.split(/\r?\n/)) {
    const match = RESTOCK_LINE.exec(rawLine)
    if (!match) continue
    const name = match[1].trim()
    const qty = Number(match[2])
    const unit = match[3].trim()
    if (!Number.isFinite(qty) || qty <= 0) continue
    const item = byName.get(name.toLowerCase())
    if (!item) continue
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push({
      itemId: item.id,
      itemName: item.name,
      qty,
      unit: unit || item.unit,
    })
  }
  return out
}

/** Strip machine RESTOCK lines from text shown to the user. */
export function stripRestockLines(reply: string): string {
  return reply
    .split(/\r?\n/)
    .filter((line) => !RESTOCK_LINE.test(line))
    .join('\n')
    .trim()
}

export async function askInventoryAi(args: {
  question: string
  items: InventoryItem[]
  courseName: string
  language: Language
  history: InventoryAiChatMessage[]
}): Promise<InventoryAiResult> {
  const { question, items, courseName, language, history } = args
  const context = buildInventoryContext(items, courseName, language)
  const label = language === 'ko' ? '[재고 데이터]' : '[INVENTORY DATA]'
  const message = [
    advisorPreamble(language),
    '',
    label,
    context,
    '',
    language === 'ko' ? `질문: ${question.trim()}` : `Question: ${question.trim()}`,
  ].join('\n')

  const secretaryHistory: SecretaryMessage[] = history
    .filter((m) => m.text.trim())
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.text }))

  const { reply, provider_used } = await callSecretary(message, secretaryHistory)
  const text = reply?.trim() || ''
  return {
    reply: text,
    displayText: stripRestockLines(text) || text,
    suggestions: parseRestockSuggestions(text, items),
    provider_used,
  }
}

export function lowStockBriefingPrompt(language: Language): string {
  return language === 'ko'
    ? '부족 재고를 요약하고, 우선 보충할 품목과 권장 수량을 제안해 주세요.'
    : 'Summarize low-stock items and suggest what to reorder first, with recommended quantities.'
}
